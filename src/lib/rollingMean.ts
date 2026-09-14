/** Inclusive trailing window over chronological observations, including tied timestamps. */
export function rollingMean(points: { epoch: number; value: unknown }[], windowMs: number) {
  const result = new Map<number, number | null>();
  let left = 0, right = 0, total = 0, count = 0;
  const valid = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  for (const point of points) {
    while (right < points.length && points[right].epoch <= point.epoch) {
      const value = points[right++].value;
      if (valid(value)) { total += value; count++; }
    }
    while (left < right && points[left].epoch < point.epoch - windowMs) {
      const value = points[left++].value;
      if (valid(value)) { total -= value; count--; }
    }
    result.set(point.epoch, count >= 2 ? total / count : null);
  }
  return result;
}
