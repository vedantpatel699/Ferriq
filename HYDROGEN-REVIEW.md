# Hydrogen Production checklist

Reviewed 2026-11-16. Website implementation only; Python and submission ZIP are unchanged.

## Requirements and sources

- [x] Client's Hydrogen production email (2026-11-07): display H2 production, CO2 production and water consumption for gas feeds. Private email and source workbook are not included in this commit.
- [x] Supplied workbook, Reactions and Cases A/B: transcribed feed flows/compositions and three formation-based conversion profiles. Local source audit records the original formulas and discrepancies.
- [x] User decisions: independently select feed A/B and conversion Dataset 1/2/3; edit prefilled inputs; route hydrogenation gas through reformer; carry calculated reformer outlet into shift; exclude HC PSA, excess steam, trends and live integration.
- [x] Three outputs: recovered H2 after PSA, newly generated CO2 plus total process CO2, and reaction-water consumption. Per-feed contributions reconcile to totals.
- [x] Standard-volume basis uses full-precision ideal-gas molar volume at 15 C and 101.325 kPa absolute. Conditions appear only in the manual, not calculation settings. Water/CO2 mass conversion uses documented 18/44 kg/kmol.

## Changes and assumptions

- [x] Added shared TypeScript calculation path, static page, engineering manual, overview tile and sidebar link. Existing model pages are retained.
- [x] Formation fractions are applied uniformly to C1-C6 paraffins; unreacted hydrocarbons remain in the outlet. Feed H2 passes through, CO participates in shift and N2 remains inert.
- [x] Dataset 2 shift uses dry-gas expansion: (0.123 - 0.0282) / (0.123 * 1.0282). Hydrogenation contribution includes incoming H2 and methane-derived H2, rather than adding total gas as H2.
- [x] Composition rounding within 0.02 percentage points is normalized; entered values remain visible. Larger discrepancies, negative/nonfinite values and conversion above 100% are rejected. Results clear on edits until recalculation.
- [x] Save/restore uses browser-local scenario storage. Invalid saved data and unavailable storage are handled without replacing the original stored scenario.

## Verification

- [x] 145 unit tests, including seven hydrogen tests: all six combinations, C/H/O closure, stoichiometric limits, incoming H2/CO/CO2, inert/zero feeds, PSA recovery, rounding, invalid input and overflow.
- [x] Production build; lint has no errors and eight existing warnings outside the new files.
- [x] Existing Python parity/regression and submission checks pass. No Python deliverable was changed or added.
- [x] 32 desktop/tablet browser checks: all six feed/profile combinations, input edits, recalculation, save/reload, restore, invalid inputs, storage failures, accessibility, narrow layout, all model routes and removed-page regression. Visual inspection caught and corrected clipped manual formulas.
- Release gate after push: verify the exact commit's Pages workflow and rerun hydrogen workflows against the deployed site. Keep run logs and screenshots in ignored local `tmp/` and report the commit/run in the delivery response.

## Remaining source uncertainties

- Conversion profiles are scenario estimates, not equilibrium predictions or validated plant performance. Source formation/disappearance carbon differences remain documented in the website manual.
- Dataset 2 correction assumes comparable dry analyses, shift only, and no intervening gas additions/removal.
- Dataset 3 shift reference flows repeat Dataset 1 and differ slightly from its reformer outlet. Retain its supplied factor; its incomplete composition is not used as a new feed preset. Either complete A/B feed can use this profile.
- No claims of total plant emissions, total steam demand, makeup water, energy balance or live measurement are made.
