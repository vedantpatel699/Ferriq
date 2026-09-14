import { describe, expect, it } from "vitest";
import { csv, parseCsv } from "./files";

describe("CSV exports", () => {
  it("neutralizes formula text including negative formulas and whitespace prefixes", () => {
    const values = ["=1+1", "+1+1", "-1+1", "@SUM(A1)", "  =1+1", "\n=1+1", "\tformula"];
    const rows = parseCsv(csv(values.map(value => ({ value, kind: "note" }))));
    expect(rows.map(row => row.value)).toEqual(values.map(value => "'" + value));
  });
  it("preserves numeric measurements, commas, quotes and multiline notes", () => {
    expect(parseCsv(csv([{ value: -12.5, note: 'Measured, "verified"\nsecond line' }]))).toEqual([
      { value: "-12.5", note: 'Measured, "verified"\nsecond line' },
    ]);
  });
});
