export const COMPONENTS = [
  "H2",
  "N2",
  "CO",
  "CO2",
  "CH4",
  "C2H6",
  "C3H8",
  "C4H10",
  "C5H12",
  "C6H14",
] as const;
export const COMPONENT_LABELS = [
  "H₂",
  "N₂",
  "CO",
  "CO₂",
  "CH₄",
  "C₂H₆",
  "C₃H₈",
  "C₄H₁₀",
  "C₅H₁₂",
  "C₆H₁₄",
];
export const FEED_NAMES = [
  "Chemical feed gas",
  "Natural gas",
  "Hydrogenation gas",
];
export const MOLAR_VOLUME = (8.31446261815324 * 288.15) / 101.325;
export type Feed = { flow: number; composition: number[] };
export type Settings = {
  toCO: number;
  toCO2: number;
  shift: number;
  recovery: number;
};
// Fractions from the supplied reaction datasets. Dataset 2 shift reconciles
// the dry CO concentrations with Nout = Nin + CO converted.
export const PROFILES: Settings[] = [
  {
    toCO: 1198.24796 / 2799.342,
    toCO2: 860.32926 / 2799.342,
    shift: (1198.24796 - 302.46683) / 1198.24796,
    recovery: 0.9,
  },
  {
    toCO: 1157.1522822335025 / 2710.805782571912,
    toCO2: 856.8985731810491 / 2710.805782571912,
    shift: (0.123 - 0.0282) / (0.123 * (1 + 0.0282)),
    recovery: 0.9,
  },
  {
    toCO: 1184.917011989101 / 2776.5916331258095,
    toCO2: 844.5407485388594 / 2776.5916331258095,
    shift: (1187.8776 - 299.3699) / 1187.8776,
    recovery: 0.9,
  },
];
export function feedPreset(id: "A" | "B"): Feed[] {
  return [
    {
      flow: id === "A" ? 16173 : 0,
      composition: [18.28, 0, 0, 0, 41.97, 19.17, 11.91, 6.72, 1.94, 0],
    },
    {
      flow: id === "A" ? 40403 : 62424,
      composition: [0, 1.6, 0, 0.69, 93.875, 2.88, 0.75, 0.18, 0.02, 0.005],
    },
    {
      flow: id === "A" ? 0 : 1931,
      composition: [96, 0, 0, 0, 4, 0, 0, 0, 0, 0],
    },
  ];
}
export type Scenario = {
  feedCase: "A" | "B";
  profile: number;
  feeds: Feed[];
  settings: Settings;
};
export const defaultScenario = (): Scenario => ({
  feedCase: "A",
  profile: 0,
  feeds: feedPreset("A"),
  settings: { ...PROFILES[0] },
});
export function validateScenario(value: unknown): asserts value is Scenario {
  const s = value as Scenario;
  if (
    !s ||
    !["A", "B"].includes(s.feedCase) ||
    !Number.isInteger(s.profile) ||
    s.profile < 0 ||
    s.profile > 2 ||
    !s.settings ||
    !Array.isArray(s.feeds) ||
    s.feeds.length !== 3
  )
    throw new Error("Scenario is incomplete. Restore a preset.");
  for (const key of ["toCO", "toCO2", "shift", "recovery"] as const)
    if (
      !Number.isFinite(s.settings[key]) ||
      s.settings[key] < 0 ||
      s.settings[key] > 1
    )
      throw new Error("Conversion and recovery must be between 0 and 100%.");
  if (s.settings.toCO + s.settings.toCO2 > 1)
    throw new Error(
      "Reformer CO and CO₂ conversion must total no more than 100%.",
    );
  s.feeds.forEach((f, i) => {
    if (!f || !Number.isFinite(f.flow) || f.flow < 0)
      throw new Error(
        `${FEED_NAMES[i]} flow must be a finite, nonnegative number.`,
      );
    if (
      !Array.isArray(f.composition) ||
      f.composition.length !== COMPONENTS.length ||
      f.composition.some((v) => !Number.isFinite(v) || v < 0 || v > 100)
    )
      throw new Error(
        `${FEED_NAMES[i]} composition requires ten values between 0 and 100%.`,
      );
    const total = f.composition.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.02 + 1e-10)
      throw new Error(
        `${FEED_NAMES[i]} composition must total 100% (rounding allowance ±0.02 percentage points).`,
      );
  });
}
export function calculateHydrogen(s: Scenario) {
  validateScenario(s);
  const { toCO: a, toCO2: b, shift, recovery } = s.settings;
  const feeds = s.feeds.map((feed) => {
    const sum = feed.composition.reduce((x, y) => x + y, 0);
    const inlet = feed.composition.map(
      (x) => ((feed.flow / MOLAR_VOLUME) * x) / sum,
    );
    const reformer = [...inlet];
    let reformerWater = 0;
    for (let i = 4; i < COMPONENTS.length; i++) {
      const n = i - 3,
        mol = inlet[i];
      reformer[i] = mol * (1 - a - b);
      reformer[0] += mol * ((2 * n + 1) * a + (3 * n + 1) * b);
      reformer[2] += mol * n * a;
      reformer[3] += mol * n * b;
      reformerWater += mol * n * (a + 2 * b);
    }
    const shiftedCO = reformer[2] * shift;
    const outlet = [...reformer];
    outlet[0] += shiftedCO;
    outlet[2] -= shiftedCO;
    outlet[3] += shiftedCO;
    return {
      inlet,
      reformer,
      outlet,
      inletH2: inlet[0],
      generatedH2: outlet[0] - inlet[0],
      beforePSA: outlet[0],
      productH2: outlet[0] * recovery,
      generatedCO2: outlet[3] - inlet[3],
      totalCO2: outlet[3],
      water: reformerWater + shiftedCO,
      remainingCO: outlet[2],
    };
  });
  const totals = {
    inletH2: 0,
    generatedH2: 0,
    beforePSA: 0,
    productH2: 0,
    generatedCO2: 0,
    totalCO2: 0,
    water: 0,
    remainingCO: 0,
  };
  for (const row of feeds)
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] += row[key];
  if (
    Object.values(totals).some((v) => !Number.isFinite(v)) ||
    !Number.isFinite(totals.productH2 * MOLAR_VOLUME)
  )
    throw new Error(
      "Inputs exceed the supported calculation range. Reduce the feed flow.",
    );
  return { feeds, totals };
}
