import { SummaryList } from "../components/SummaryList";
export function WatchlistPage() {
  return (
    <>
      <h1>Watchlist</h1>
      <p className="source-note">
        Calculated from the same dataset and configuration as each detail page.
        Observations are reference snapshots, not a live plant feed. Review
        order follows condition severity, then data quality.
      </p>
      <SummaryList watchOnly />
    </>
  );
}
