# Air Blower reference input mapping

The Air Blower source anchors map the workbook tags below into the model input schema. Forty-six validated daily anchors cover 1 May through 15 June 2025 while Blower A is the running train. The 200-row reference test CSV preserves those anchors and fills intermediate timestamps by deterministic linear interpolation of measured numeric fields. Train-specific measurements remain separate and unavailable signals remain blank.

| Ferriq field | Workbook tag | Source description | Source unit | Conversion |
| --- | --- | --- | --- | --- |
| Motor Current A | 1645-HS-3301.II.PV | BL301A average current | A | none |
| Motor Current B | 1645-HS-3302.II.PV | BL301B average current | A | none |
| Suction Press A | 1645-PI-3110.PV | BL301A blower suction | kPaa | none |
| Suction Press B | 164545-PI-3111.PV | BL301B blower suction | kPaa | none |
| Discharge Press A | 1645-PIC-3101.PV | BL301A discharge pressure controller PV | kPa | interpreted as kPag |
| Discharge Press B | 1645-PIC-3104.PV | BL301B discharge pressure controller PV | kPa | interpreted as kPag |
| Controller SP A | 1645-PIC-3101.SP | BL301A discharge controller SP | kPa | used as kPag setpoint |
| Controller SP B | 1645-PIC-3104.SP | BL301B discharge controller SP | kPa | used as kPag setpoint |
| Bypass OP A | 1645-FIC-3108O1.PV | BL301A bypass valve position | % | none |
| Bypass OP B | 1645-FIC-3111O1.PV | BL301B bypass valve position | % | none |
| Filter DP A | 1645-PDI-3102.PV | BL301A air-filter suction DP | Pa | divide by 100000 to bar |
| Filter DP B | 1645-PDI-3103.PV | BL301B air-filter suction DP | Pa | divide by 100000 to bar |
| Vibration A1–A4 | 1645-VI-3174/3175/3200/3201.PV | BL301A blower-bearing vibration | mm/s | none |
| Bearing Temp A1–A2 | 1645-TI-3215/321645.PV | BL301A blower-bearing temperature | °C | none |
| Total Flow | 1645-FIC-3113.PV | BU301 combustion-air feed | Nm³/h | none |
| Discharge Temp A | 1645-TI-3103.PV | BL301A blower discharge | °C | none |

The supplied workbook does not identify B vibration probes, B bearing-temperature probes, a B discharge-temperature tag, a suction-temperature tag, an axial-position tag, or a thrust-bearing-temperature tag. Those fields therefore remain unavailable in the reference dataset.