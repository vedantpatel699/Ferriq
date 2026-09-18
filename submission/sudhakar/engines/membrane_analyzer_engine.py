"""Hydrogen recovery, purity, pressure deviation and feed/nonpermeate ratio.

All gas flows must share the same normal-volume basis (Nm3/h); composition
is vol%; pressure kPag. Missing nonpermeate is feed minus permeate only when
physically possible. Missing online feed H2 uses lab H2 for recovery, without
inventing continuous measurements. Zero permeate gives zero recovery.
Run: python engines/membrane_analyzer_engine.py examples/membrane-analyzer.input.json
"""
from common import finite,execute,cli

def calc_row(row,c):
    fields='feedFlowNm3Hr nonPermeateFlowNm3Hr permeateFlowNm3Hr permeateH2OnlinePct permeateH2LabPct feedH2LabPct feedH2OnlinePct feedPressureKpag'.split()
    r={k:row.get(k) for k in fields}
    r={k:(v if finite(v) and v>=0 and (not k.endswith('Pct') or v<=100) else None) for k,v in r.items()}
    f,p=r['feedFlowNm3Hr'],r['permeateFlowNm3Hr']; balanced=f is not None and p is not None and p<=f
    n=r['nonPermeateFlowNm3Hr']
    if n is None and balanced:n=f-p
    y=r['feedH2OnlinePct'] if r['feedH2OnlinePct'] is not None else r['feedH2LabPct']
    def recovery(feed,purity):return p*purity/(f*feed)*100 if balanced and f>0 and feed is not None and feed>0 and purity is not None else None
    pressure=r['feedPressureKpag']
    return {'timestamp':row['timestamp'],'nonPermeateFlowNm3Hr':n,'ratio':f/n if f is not None and n is not None and n>0 else None,
      'recoveryOnlinePct':recovery(y,r['permeateH2OnlinePct']),'recoveryLabPct':recovery(r['feedH2LabPct'],r['permeateH2LabPct']),
      'feedPressureKpag':pressure,'feedPressureDeviationPct':100*(pressure-c['designFeedPressureKpag'])/c['designFeedPressureKpag'] if pressure is not None and c['designFeedPressureKpag']>0 else None,
      **{k:r[k] for k in ('permeateH2OnlinePct','permeateH2LabPct','feedH2OnlinePct','feedH2LabPct','feedFlowNm3Hr')}}

from alerts import annotate

def calculate(rows,config,parameters):return [annotate('membrane-analyzer',calc_row(r,config),config) for r in rows]
def run(payload):return execute(payload,'membrane-analyzer',calculate)
if __name__=='__main__':cli(run)
