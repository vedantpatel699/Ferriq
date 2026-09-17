import type { ReactNode } from "react";

export function ManualSection({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="manual-section">
      <h3>{title}</h3>
      {intro && <div className="manual-intro">{intro}</div>}
      {children}
    </section>
  );
}

export function FormulaBlock({
  name,
  children,
  note,
}: {
  name?: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <figure className="formula-block">
      {name && <figcaption>{name}</figcaption>}
      <div className="formula-expression">{children}</div>
      {note && <div className="formula-note">{note}</div>}
    </figure>
  );
}

export function ModelTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <nav className="page-tabs model-tabs" aria-label="Model sections">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={active === tab ? "active" : undefined}
          aria-current={active === tab ? "page" : undefined}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
