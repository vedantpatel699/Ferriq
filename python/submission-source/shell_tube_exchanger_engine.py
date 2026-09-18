"""Single-phase exchanger duty, N-shell F correction, U and fouling.

Flows kg/h; Cp kJ/(kg K); temperatures degC; area m2; U W/(m2 K).
Duty is kW/MW; Rf is reported in 1e-4 m2 K/W. Null U/Rf is retained on
invalid correction-factor domains; no substitute F is inserted. Geometry
assumes the website's N-shell/2N-tube-pass arrangement, not every TEMA type.
Run: python engines/shell_tube_exchanger_engine.py examples/shell-tube-exchanger.input.json
"""
import math
from common import finite, execute, cli

def correction(P,R,N):
    if not all(finite(x) for x in (P,R,N)) or P<0 or R<0 or int(N)!=N or N<=0 or P>=1 or P*R>=1: return None
    if abs(R-1)<1e-9:
        den=N-P*(N-1)
        if abs(den)<1e-9: return None
        p=P/den; s=p*math.sqrt(2)/(2-p)
        if abs(s)>=1: return None
        a=.5*math.log((1+s)/(1-s))
        return 1. if abs(a)<1e-9 else p*math.sqrt(2)/((2-p)*a)
    x=((1-P*R)/(1-P))**(1/N)
    if abs(R-x)<1e-9:return None
    p=(1-x)/(R-x); a=math.sqrt(R*R+1); b=(1-p)/(1-p*R)
    c=2-p*(R+1-a); d=2-p*(R+1+a)
    if b<=0 or c<=0 or d<=0:return None
    log=math.log(c/d)
    return 1. if abs(log)<1e-9 else a*math.log(b)/((R-1)*log)

def calc_row(r,c):
    keys='qHotKw qColdKw qAvgKw qAvgMw imbalancePct lmtdC lmtdEffC pRatio rRatio fFactor uDirtyWm2k rfE4 effectivenessPct approachHotC approachColdC dutyDeviationPct'.split()
    o=dict.fromkeys(keys);o.update(timestamp=r['timestamp'],crossover=False,shellDpBar=r.get('shellDpBar'),tubeDpBar=r.get('tubeDpBar'))
    th,tho,tc,tco,mh,cph,mc,cpc=[r.get(k) for k in 'hotInC hotOutC coldInC coldOutC hotFlowKgHr hotCpKjKgK coldFlowKgHr coldCpKjKgK'.split()]
    if not all(finite(x) for x in (th,tho,tc,tco,mh,cph,mc,cpc)):return o
    if min(mh,cph,mc,cpc)<=0 or min(th,tho,tc,tco)<=-273.15 or th<tho or tco<tc or not finite(c['areaM2']) or c['areaM2']<=0:return o
    o['qHotKw']=mh*cph*(th-tho)/3600;o['qColdKw']=mc*cpc*(tco-tc)/3600
    q=(o['qHotKw']+o['qColdKw'])/2;o['qAvgKw']=q;o['qAvgMw']=q/1000
    if abs(q)>1e-9:o['imbalancePct']=100*abs(o['qHotKw']-o['qColdKw'])/abs(q)
    cmin=min(mh*cph/3600,mc*cpc/3600)
    if th>tc and cmin>0:o['effectivenessPct']=100*q/(cmin*(th-tc))
    d1,d2=th-tco,tho-tc;o['approachHotC']=d1;o['approachColdC']=d2
    if c['designQMw']>0:o['dutyDeviationPct']=100*(q/1000-c['designQMw'])/c['designQMw']
    if min(d1,d2)<=0:o['crossover']=True;return o
    lmtd=(d1-d2)/math.log(d1/d2) if abs(d1-d2)>1e-9 else d1;o['lmtdC']=lmtd
    R=(th-tho)/(tco-tc) if abs(tco-tc)>1e-9 else None;P=(tco-tc)/(th-tc) if abs(th-tc)>1e-9 else None
    o['pRatio']=P;o['rRatio']=R
    F=correction(P,R,c['nShell']) if P is not None and R is not None else None;o['fFactor']=F
    if F is None:o['crossover']=True;return o
    o['lmtdEffC']=lmtd*F;den=c['areaM2']*F*lmtd
    if abs(den)>1e-9:o['uDirtyWm2k']=q*1000/den
    if o['uDirtyWm2k'] is not None and o['uDirtyWm2k']>0 and c['uCleanWm2k']>0:o['rfE4']=(1/o['uDirtyWm2k']-1/c['uCleanWm2k'])*1e4
    return o

from alerts import annotate

def calculate(rows, config, parameters):return [annotate('shell-tube-exchanger',calc_row(r,config),config) for r in rows]
def run(payload):return execute(payload,'shell-tube-exchanger',calculate)
if __name__=='__main__':cli(run)
