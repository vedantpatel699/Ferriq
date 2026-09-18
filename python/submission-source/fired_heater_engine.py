"""Fired Heater: wet-O2 combustion, heat balance and constant-Cp process duty.

Inputs: flows kg/s, temperatures degC, process Cp kJ/(kg K), wet O2 vol%.
Outputs: heat flows kW, efficiencies %, closure %, air/fuel kg/kg.
Named fuel properties are retained from the client reference; custom molar
fractions are normalized. Complete combustion and constant Cp are assumptions.
Invalid measurements yield null dependent outputs. This is not a formal PTC test.
Run: python engines/fired_heater_engine.py examples/fired-heater.input.json
"""
import json
from common import ROOT, finite, execute, cli
FUEL = json.loads((ROOT/'data/fuels.json').read_text())
PROPS, CASES = FUEL['FUEL_COMPONENT_PROPS'], FUEL['FUEL_GAS_CASES']

def composition(name, custom=None):
    if name != 'Custom': return CASES.get(name)
    if not custom: return None
    z = custom.get('fractions', {})
    if any(k not in PROPS or not finite(v) or v < 0 for k,v in z.items()): return None
    total = sum(z.values())
    if total <= 0: return None
    z = {k:v/total for k,v in z.items()}
    mw = sum(v*PROPS[k]['mw'] for k,v in z.items())
    if mw <= 0: return None
    return {'fractions':z, 'averageMw':mw, 'lhvMjKg':sum(v*PROPS[k]['mw']/mw*PROPS[k]['lhvMjKg'] for k,v in z.items())}

def combustion(mf, oxygen, comp):
    """Solve excess oxygen from wet flue-gas mol balance including feed inerts."""
    if not finite(mf) or mf <= 0 or not finite(oxygen) or not 0 <= oxygen < (100*FUEL['O2_VOL_FRAC_AIR']): return None
    mol = mf/comp['averageMw']; o2 = water = carbon = nitrogen = 0
    for k,z in comp['fractions'].items():
        if k not in PROPS: continue
        p=PROPS[k]; n=mol*z
        o2+=n*p['o2']; water+=n*p['h2o']; carbon+=n*p['co2']
        if k in ('CO2','Hydrogen_Sulfide'): carbon+=n
        if k=='Nitrogen': nitrogen+=n
    ratio=FUEL['N2_VOL_FRAC_AIR']/FUEL['O2_VOL_FRAC_AIR']
    y=oxygen/100; den=1-y*(1+ratio)
    if abs(den)<1e-9: return None
    excess=y*(carbon+water+nitrogen+o2*ratio)/den
    air=(o2+excess)*(FUEL['O2_MW']+ratio*FUEL['N2_MW'])
    return air, mf+air, air/mf

def calc_row(row, cfg):
    fields='fuelFlowKgS combustionAirTempC stackTempC fuelTempC processFlowKgS processInC processOutC processCpKjKgK stackO2Pct bridgewallAC bridgewallBC'.split()
    r={k:row.get(k) for k in fields}
    for k,v in r.items():
        if not finite(v) or (k.endswith('C') and v<=-273.15) or ('Flow' in k and v<0) or ('Cp' in k and v<=0) or (k=='stackO2Pct' and not 0<=v<(100*FUEL['O2_VOL_FRAC_AIR'])): r[k]=None
    keys='bridgewallAvgC excessAirPct etaHeatBalancePct etaPtc4Pct etaProcessPct etaDeltaPp qLhvKw qAbsorbedKw qProcessKw qFuelSensibleKw qCombustionAirKw qStackKw qRadiationLossKw qInKw combustionAirKgS stackMassKgS airFuelRatio dryLossPct moistureLossPct radiationLossPct unaccountedLossPct closurePct'.split()
    o=dict.fromkeys(keys); o.update(timestamp=row['timestamp'],stackTempC=r['stackTempC'],stackO2Pct=r['stackO2Pct'])
    wall=[r[k] for k in ('bridgewallAC','bridgewallBC') if r[k] is not None]
    o['bridgewallAvgC']=sum(wall)/len(wall) if wall else None
    comp=composition(row.get('fuelCaseOverride') or cfg['fuelCase'],cfg.get('customCase'))
    if not comp or not finite(comp['averageMw']) or comp['averageMw']<=0 or not finite(comp['lhvMjKg']) or comp['lhvMjKg']<=0: return o
    lhv=comp['lhvMjKg']*1000; mf=r['fuelFlowKgS']; oxygen=r['stackO2Pct']; tref=cfg['refTempC']
    if oxygen is not None:
        actual, stoich=combustion(1,oxygen,comp),combustion(1,0,comp)
        if actual and stoich and stoich[2]>0: o['excessAirPct']=100*(actual[2]/stoich[2]-1)
        cm=combustion(mf,oxygen,comp)
        if cm: o['combustionAirKgS'],o['stackMassKgS'],o['airFuelRatio']=cm
    if mf is not None:
        o['qLhvKw']=mf*lhv
        o['qRadiationLossKw']=o['qLhvKw']*cfg['radiationLossPct']/100
        if r['fuelTempC'] is not None: o['qFuelSensibleKw']=mf*FUEL['CP_FUEL_GAS_KJKGK']*(r['fuelTempC']-tref)
    if o['combustionAirKgS'] is not None and r['combustionAirTempC'] is not None: o['qCombustionAirKw']=o['combustionAirKgS']*FUEL['CP_COMBUSTION_AIR_KJKGK']*(r['combustionAirTempC']-tref)
    if o['stackMassKgS'] is not None and r['stackTempC'] is not None: o['qStackKw']=o['stackMassKgS']*FUEL['CP_FLUE_GAS_KJKGK']*(r['stackTempC']-tref)
    def available(*keys): return all(o[k] is not None for k in keys)
    if available('qLhvKw','qFuelSensibleKw','qCombustionAirKw'): o['qInKw']=o['qLhvKw']+o['qFuelSensibleKw']+o['qCombustionAirKw']
    if available('qInKw','qStackKw','qRadiationLossKw'): o['qAbsorbedKw']=o['qInKw']-o['qStackKw']-o['qRadiationLossKw']
    if available('qAbsorbedKw','qLhvKw') and o['qLhvKw']>0: o['etaHeatBalancePct']=100*o['qAbsorbedKw']/o['qLhvKw']
    if all(r[k] is not None for k in ('processFlowKgS','processCpKjKgK','processInC','processOutC')):
        o['qProcessKw']=r['processFlowKgS']*r['processCpKjKgK']*(r['processOutC']-r['processInC'])
        if o['qLhvKw'] is not None and o['qLhvKw']>0: o['etaProcessPct']=100*o['qProcessKw']/o['qLhvKw']
    if o['excessAirPct'] is not None and r['stackTempC'] is not None:
        air=(1+o['excessAirPct']/100)*combustion(1,0,comp)[2]
        water=sum(v*PROPS[k]['h2o'] for k,v in comp['fractions'].items() if k in PROPS)*18.02/comp['averageMw']
        amb=r['combustionAirTempC'] if r['combustionAirTempC'] is not None else tref
        tf=r['fuelTempC'] if r['fuelTempC'] is not None else 25
        o['dryLossPct']=100*(1+air-water)*FUEL['CP_FLUE_GAS_PTC4_KJKGK']*(r['stackTempC']-amb)/lhv
        o['moistureLossPct']=100*water*FUEL['CP_VAPOR_KJKGK']*(r['stackTempC']-tf)/lhv
        o['radiationLossPct']=cfg['radiationLossPct'];o['unaccountedLossPct']=cfg['unaccountedLossPct']
        o['etaPtc4Pct']=100-o['dryLossPct']-o['moistureLossPct']-o['radiationLossPct']-o['unaccountedLossPct']
    if available('etaHeatBalancePct','etaProcessPct'): o['etaDeltaPp']=o['etaHeatBalancePct']-o['etaProcessPct']
    if available('qAbsorbedKw','qProcessKw','qLhvKw') and o['qLhvKw']>0: o['closurePct']=100*abs(o['qAbsorbedKw']-o['qProcessKw'])/o['qLhvKw']
    return o

from alerts import annotate

def calculate(rows, config, parameters):
    """Evaluate every observation independently; common.py applies date summaries."""
    return [annotate('fired-heater',calc_row(r,config),config) for r in rows]

def run(payload): return execute(payload,'fired-heater',calculate)
if __name__=='__main__': cli(run)
