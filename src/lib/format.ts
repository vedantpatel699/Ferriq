export function formatNumber(value: unknown, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-CA", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    : "—";
}
export function labelFor(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (s) => s.toUpperCase());
}
export function reviewMessage(text: string): string {
  return text
    .replace(
      / - schedule clean\.?/i,
      " — review cleaning need and measurement quality.",
    )
    .replace(
      / - over-recovery, lower controller setpoint\.?/i,
      " — review recovery control with operations.",
    )
    .replace(/ - replace filter\.?/i, " — review filter condition.");
}
