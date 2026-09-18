"""Configured engineering alerts. Sources/severity match website alert builders.

Missing metrics do not establish normal equipment health. Consumers must also
inspect null calculated values; severity is only the roll-up of available alerts.
"""
from common import finite

def annotate(model, row, cfg):
    alerts=[]
    def add(severity,source):alerts.append(dict(severity=severity,source=source))
    def threshold(key,alarm,advisory,source,low=False,absolute=False):
        v=row.get(key)
        if not finite(v):return
        if absolute:v=abs(v)
        if (v<cfg[alarm] if low else v>=cfg[alarm]):add('alarm',source)
        elif (v<cfg[advisory] if low else v>=cfg[advisory]):add('advisory',source)
    def below(key,limit,source):
        if finite(row.get(key)) and row[key]<cfg[limit]:add('advisory',source)
    if model=='fired-heater':
        threshold('etaHeatBalancePct','effAlarmPct','effAdvisoryPct','configured efficiency threshold',True)
        threshold('stackTempC','stackAlarmC','stackAdvisoryC','convection fouling')
        threshold('bridgewallAvgC','bwAlarmC','bwAdvisoryC','tube metallurgy')
        v=row.get('stackO2Pct')
        if finite(v):
            if v<cfg['o2LowPct']:add('alarm','combustion safety')
            elif v>cfg['o2HighPct']:add('advisory','burner trim')
        threshold('excessAirPct','eaAlarmPct','eaAdvisoryPct','configured excess-air threshold')
        if finite(row.get('etaDeltaPp')) and abs(row['etaDeltaPp'])>3:add('advisory','closure check')
    elif model=='shell-tube-exchanger':
        if row['crossover']:add('alarm','LMTD / F-factor')
        threshold('rfE4','rfAlarmE4','rfAdvisoryE4','fouling')
        threshold('dutyDeviationPct','dutyAlarmPct','dutyAdvisoryPct','duty vs design',absolute=True)
        below('effectivenessPct','effAdvisoryPct','effectiveness')
        if finite(row.get('imbalancePct')) and row['imbalancePct']>cfg['imbalanceAdvisoryPct']:add('advisory','energy balance')
        below('approachHotC','approachMinC','approach');below('approachColdC','approachMinC','approach')
    else:
        if finite(row.get('ratio')) and row['ratio']>=cfg['ratioAlarm']:add('alarm','recovery ratio controller')
        below('recoveryOnlinePct','recoveryFloorPct','recovery target')
        threshold('permeateH2OnlinePct','purityAlarmPct','purityAdvisoryPct','permeate analyzer',True)
        p=row.get('feedPressureKpag');design=cfg['designFeedPressureKpag']
        if finite(p) and (abs((p-design)/design*100) if design else float('inf') if p else 0)>cfg['feedPressureDeviationPct']:add('advisory','feed pressure')
    return {**row,'alerts':alerts,'severity':'alarm' if any(a['severity']=='alarm' for a in alerts) else 'advisory' if alerts else 'ok'}
