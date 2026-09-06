import { useEffect, useRef, type ReactNode } from "react";

export interface CalcBasisSection {
  heading: string;
  paragraphs: ReactNode[];
}

export interface CalculationBasisDialogProps {
  open: boolean;
  onClose: () => void;
  sections: CalcBasisSection[];
}

/** The real, working "Calculation basis & references" drawer — formulas,
 *  standards citations, methodology, and known limitations live here,
 *  behind progressive disclosure, never inline on the main page. Uses the
 *  native <dialog> element for built-in focus trapping, Esc-to-close, and
 *  a11y semantics rather than a hand-rolled modal or an extra dependency. */
export function CalculationBasisDialog({ open, onClose, sections }: CalculationBasisDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      style={{ position: "fixed", top: 0, right: 0, left: "auto", margin: 0, height: "100vh", maxHeight: "100vh" }}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="drawer-head">
        <span className="drawer-title">Calculation basis &amp; references</span>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>
      {sections.map((s, i) => (
        <div className="drawer-section" key={i}>
          <h4>{s.heading}</h4>
          {s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
        </div>
      ))}
    </dialog>
  );
}
