"""Furnace Skin TI: timestamp regression and separate trained-horizon trees.

Thermocouples/driver temperatures use degC; history timestamps retain gaps.
Trees use the bundled original feature units and missing-value directions.
Thirty-day slopes project up to 2,555 days; these are unvalidated extrapolations,
not calibrated service-life predictions. Missing operating inputs are disclosed.
Pass 3 what-if coefficients reproduce the website's explicit POC assumption.
Run: python engines/furnace_skin_ti_predictor_engine.py examples/furnace-skin-temp.input.json
"""
import copy
import json
import math
from common import ROOT, finite, epoch, execute, cli
HORIZON=2555

def tree(node,x):
    if 'v' in node:return node['v']
    value=x[node['f']]
    left=(node.get('m')==1) if not finite(value) else value<node['t']
    return tree(node['l' if left else 'r'],x)

def prediction(model,x):return (model.get('base_score') or 0)+sum(tree(t,x) for t in model.get('trees',[]))

def slope(points,last):
    if not points:return None
    xs=[(t-last)/86400000 for t,v in points]; ys=[v for t,v in points]
    mx,my=sum(xs)/len(xs),sum(ys)/len(ys)
    den=sum((x-mx)**2 for x in xs)
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/den if den>0 else None

def forecast_tc(model,state,history,alias,hours):
    points=[(epoch(r['t']),r.get(alias)) for r in history]
    if not points or not finite(points[-1][1]) or not finite(hours) or hours<=0:return None
    now,value=points[-1]
    recent=[(t,v) for t,v in points if finite(v) and now-30*86400000<=t<=now]
    if len(recent)<2:return None
    trend=slope(recent,now)
    if trend is None:return None
    week=[(t,v) for t,v in recent if t>now-7*86400000]
    mean=sum(v for t,v in week)/len(week); velocity=slope(week,now)
    if velocity is None:velocity=trend
    lag=next((v for t,v in points if t==now-7*86400000 and finite(v)),None)
    derived={'tc_now':value,'skin_max_now':value,'tc_7d_mean':mean,'skin_max_7d_mean':mean,
             'tc_velocity_c_per_d':(value-lag)/7 if lag is not None else None,'skin_max_velocity_c_per_d':(value-lag)/7 if lag is not None else None}
    x=[derived[k] if k in derived else state.get(k) for k in model['feature_names']]
    low,mid,high=[prediction(model[k],x) for k in ('p10','p50','p90')]
    if not all(finite(v) for v in (low,mid,high)):return None
    forecast=[{'day':d,'value':value+trend*d,'p10':value+trend*d,'p50':value+trend*d,'p90':value+trend*d} for d in range(1,HORIZON+1)]
    return {'tcAlias':alias,'tcNow':value,'tcVelocityCPerDay':velocity,'slopePerDay':trend,'forecast':forecast,'mean7d':mean,
            'missingModelInputs':[k for k,v in zip(model['feature_names'],x) if not finite(v)],
            'modelPrediction':{'hours':hours,'p10':min(low,mid,high),'p50':mid,'p90':max(low,mid,high)}}

def forecast_pass(furnace,number,limit,hours):
    if not finite(furnace.get('cadence_hours')) or furnace['cadence_hours']<=0:return None
    aliases=[a for a,m in furnace['tc_models'].items() if m['pass']==number]
    indices=[i for i,r in enumerate(furnace['history']) if any(finite(r.get(a)) for a in aliases)]
    if not indices:return None
    history=furnace['history'][:indices[-1]+1]
    state={k:v for k,v in history[-1].items() if finite(v)}
    results=[r for a in aliases if (r:=forecast_tc(furnace['tc_models'][a],state,history,a,hours)) is not None]
    if not results:return None
    forecast=[]
    for i in range(HORIZON):
        driver=max(results,key=lambda r:r['forecast'][i]['value'])
        forecast.append({**driver['forecast'][i],'drivenBy':driver['tcAlias']})
    skin=max(r['tcNow'] for r in results)
    crossings=[0 if r['tcNow']>=limit else 24*(limit-r['tcNow'])/r['slopePerDay'] for r in results if r['tcNow']>=limit or r['slopePerDay']>0]
    crossings=[v for v in crossings if finite(v) and v<=HORIZON*24]
    observation=epoch(history[-1]['t'])
    return {'observationEpoch':observation,'dataAgeHours':(epoch(furnace['history'][-1]['t'])-observation)/3600000,
            'missingThermocouples':[a for a in aliases if not any(r['tcAlias']==a for r in results)],
            'skinNowC':skin,'skin7dMeanC':sum(r['mean7d'] for r in results)/len(results),
            'skinVelocityCPerDay':sum(r['tcVelocityCPerDay'] for r in results)/len(results),
            'forecast':forecast,'hoursToAlarm':0 if skin>=limit else min(crossings) if crossings else None,
            'hoursToAlarmUpperBand':0 if skin>=limit else None,'extrapolatedDays':None,'horizonDays':HORIZON,
            'finalProjection':forecast[-1],'tcResults':results}

def status(skin,hours):
    if skin>=470 or (hours is not None and hours<24):return 'alarm'
    if skin>=460 or (hours is not None and hours<72):return 'advisory'
    return 'ok'

def scenario(baseline,reference,split,limit):
    if not finite(split) or not 0<split<100:raise ValueError('Flow split must be between 0 and 100 percent')
    delta=split-reference;forecast=[]
    for f in baseline['forecast']:
        effect=delta*(.36+1.44*math.exp(-(f['day']-1)/2))
        spread=abs(delta)*(.4+math.sqrt(max(0,f['day']-1))*.25)
        forecast.append({**f,'value':f['value']+effect,'p50':f['p50']+effect,'p10':f['p10']+effect-spread,'p90':f['p90']+effect+spread})
    previous=baseline['skinNowC'];hour=0;crossing=0 if previous>=limit else None
    for f in forecast:
        nxt=f['day']*24
        if crossing is None and previous<limit<=f['value']:crossing=hour+(limit-previous)/(f['value']-previous)*(nxt-hour)
        previous,hour=f['value'],nxt
    return {'split':split,'delta':delta,'effect24':[min(.8*delta,2.8*delta),max(.8*delta,2.8*delta)],'forecast':forecast,'hoursToThreshold':crossing,'mode':'POC simulation - not validated'}

def calculate(rows,config,parameters):
    """Use supplied observations with packaged trees; never move holdout dates."""
    bundle=parameters.get('model') or json.loads((ROOT/'data/furnace-model.json').read_text())
    f=copy.deepcopy(bundle['furnaces'][config['furnace']]);f['history']=[{'t':r['timestamp'],**{k:v for k,v in r.items() if k!='timestamp'}} for r in rows]
    number=config['pass'];days=config['horizonDays']
    if not isinstance(number,int) or not 1<=number<=f['passes'] or not isinstance(days,int) or not 1<=days<=HORIZON:raise ValueError('Invalid pass or projection horizon')
    limit=bundle['alarm_threshold_c']
    passes=[forecast_pass(f,p,limit,bundle['horizon_hours']) for p in range(1,f['passes']+1)]
    selected=passes[number-1]
    result={'passes':passes,'severity':status(selected['skinNowC'],selected['hoursToAlarm']) if selected else 'unavailable',
            'projection':selected['forecast'][:days] if selected else [],'scenario':None}
    if 'flowSplit' in parameters and selected:
        flows=[rows[-1].get('flow_p'+str(p)) for p in range(1,f['passes']+1)]
        if any(not finite(v) or v<=0 for v in flows):raise ValueError('Complete positive pass flows required for scenario')
        if number!=3:raise ValueError('Scenario is available for Pass 3 only')
        result['scenario']=scenario(selected,100*flows[2]/sum(flows),parameters['flowSplit'],limit)
    return result

def run(payload):return execute(payload,'furnace-skin-temp',calculate)
if __name__=='__main__':cli(run)
