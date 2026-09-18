/** Same numeric contract as Python parity; never relax discrete/display values. */
export function firstDifference(
  a: unknown,
  b: unknown,
  path = "cases",
): string | null {
  if (a === b) return null;
  if (
    typeof a === "number" &&
    typeof b === "number" &&
    Number.isFinite(a) &&
    Number.isFinite(b)
  ) {
    if (
      Math.abs(a - b) <=
      Math.max(1e-9, 1e-9 * Math.max(Math.abs(a), Math.abs(b)))
    )
      return null;
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return `${path}: ${JSON.stringify(a)} versus ${JSON.stringify(b)}`;
  if (
    Array.isArray(a) !== Array.isArray(b) ||
    JSON.stringify(Object.keys(a)) !== JSON.stringify(Object.keys(b))
  )
    return path + ": different structure";
  for (const key of Object.keys(a)) {
    const d = firstDifference(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      path + "." + key,
    );
    if (d) return d;
  }
  return null;
}
