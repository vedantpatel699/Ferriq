# Air Blower Python engine

`engine.py` is the Python implementation of the Air Blower engineering model. The website uses the equivalent TypeScript implementation in `src/engineering/blower/calculations.ts`.

The two implementations share:

- active-train selection from motor current
- suction/discharge pressure normalization
- three-phase motor input power
- fluid-power performance indicator
- isentropic and polytropic efficiency
- vibration, bearing-temperature and process-condition alerts
- bounded suction-temperature forward fill
- expected-flow baseline regression
- measured-versus-expected flow degradation screening
- bearing and vibration trend calculations

Run the cross-language parity check with:

```sh
npm run test:python
```

The reference Air Blower input dataset is stored at `reference/blower-demo.csv`. Its source-tag mapping and units are documented in `reference/blower-tag-map.md`.
