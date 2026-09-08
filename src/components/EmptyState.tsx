export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty-state" role="alert">
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
