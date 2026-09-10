import { useEffect, useState } from "react";
import { z } from "zod";
import { CRUDES, PRODUCTS } from "../engineering/crudeToProfit/data";
const price = z.number().finite().positive();
const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.iso.datetime({ offset: true }),
  source: z.string(),
  currency: z.literal("CAD"),
  unit: z.literal("CAD/m3"),
  crude: z.record(z.enum(CRUDES), price),
  product: z.record(z.enum(PRODUCTS), price),
  refresh: z
    .object({ ok: z.boolean(), attemptedAt: z.iso.datetime({ offset: true }) })
    .optional(),
  cachedSources: z.array(z.string()).optional(),
  provenance: z.object({
    fx: z.object({ value: price, date: z.string(), source: z.string() }),
    crude: z.object({
      wti_date: z.string(),
      differential_date: z.string(),
      provenance: z.record(
        z.string(),
        z.object({ wording: z.string(), calibrated_date: z.string() }),
      ),
    }),
    product: z.object({
      alberta_ngl: z.object({
        anchor_month: z.string().nullable(),
        ok: z.boolean(),
      }),
      detail: z.record(
        z.enum(PRODUCTS),
        z.object({
          ui_label: z.string(),
          note: z.string().nullable(),
          freshness: z.object({
            observation_date: z.string().nullable(),
            status: z.string(),
          }),
        }),
      ),
    }),
  }),
});
export type LiveMarket = z.infer<typeof schema>;
export const parseLiveMarket = (value: unknown) => schema.parse(value);
export function useLiveMarket() {
  const [market, setMarket] = useState<LiveMarket | null>(null);
  const [status, setStatus] = useState(
    "Loading published market observations…",
  );
  const [loading, setLoading] = useState(true);
  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/crude-market-prices.json`,
        { cache: "no-store", signal },
      );
      if (!response.ok) throw Error();
      const loaded = parseLiveMarket(await response.json());
      if (signal?.aborted) return;
      setMarket(loaded);
      setStatus(
        loaded.refresh?.ok === false
          ? "The publication's market refresh failed. Showing the previous snapshot with original dates."
          : "Latest published snapshot loaded. Source observations may lag publication.",
      );
    } catch {
      if (!signal?.aborted)
        setStatus(
          "Price refresh unavailable. Any previously loaded snapshot retains its original dates.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  async function refresh() {
    setLoading(true);
    await load();
  }
  useEffect(() => {
    const controller = new AbortController();
    // The fetch is awaited before any state update; this effect only starts I/O.
    // oxlint-disable-next-line react/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  return { market, status, loading, refresh };
}
