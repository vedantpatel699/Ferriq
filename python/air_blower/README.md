# Air Blower Python reference engine

`engine.py` is the uploaded Python reference implementation for the Air Blower calculation model. The current Ferriq site runs the TypeScript port in `src/engineering/blower/calculations.ts`.

## What matches

The shared engineering calculations are equivalent: three-phase shaft power, pressure normalization, fluid-power indicator, isentropic efficiency, polytropic efficiency, active-train detection, vibration/bearing/process alert thresholds, and bounded suction-temperature forward fill.

Run the cross-language check from the repository root:

```sh
npm run test:python
```

## Intentional current-site differences

This Python file is preserved as a reference rather than treated as a byte-for-byte current backend.

1. **Blower ΔP default** — Python `DEFAULT_LIMITS["blower_dp_max_bar"]` is **0.45 bar**. The live Ferriq TypeScript default is **1.00 bar**, matching the value used by the preserved live dashboard HTML. The TypeScript unit test still exercises 0.45 bar explicitly for the original worked example.
2. **Missing discharge temperature** — Python leaves the selected thermodynamic headline efficiency unavailable. Ferriq falls back to the fluid-power indicator and labels it as a fallback so the dashboard can retain a non-thermodynamic trend metric without presenting it as compressor efficiency.
3. **Output representation** — Python rounds returned row values and normalizes timestamps; the site keeps calculation precision internally and formats values at the presentation layer.
4. **Site data-quality layer** — Ferriq can suppress alerts sourced from stale/missing vibration or bearing measurements and marks affected metrics Missing/Stale/Fallback. That behavior lives in `src/engineering/catalog.ts`, outside the reference calculation engine.

These differences are deliberate and are asserted by `scripts/blower-python-parity.mjs`.
