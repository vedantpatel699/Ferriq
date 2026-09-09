import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DataTable } from "./DataTable";
interface Props {
  asset: string;
  source: string;
  summary: string;
  period: string;
  rows: Record<string, unknown>[];
  quality: string[];
}
interface Snapshot extends Props {
  capturedAt: string;
  images: { title: string; url: string }[];
}
export function BuildReport(props: Props) {
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState<Snapshot | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  function capture() {
    try {
      const images = Array.from(
        document.querySelectorAll<HTMLDivElement>("main .chart-echart"),
      )
        .filter((el) => el.getBoundingClientRect().height > 0)
        .flatMap((el) => {
          const canvas = el.querySelector("canvas");
          return canvas
            ? [
                {
                  title:
                    (el.getAttribute("aria-label") ?? "Engineering trend") +
                    " Displayed series: " +
                    Array.from(
                      el.parentElement?.querySelectorAll<HTMLInputElement>(
                        ".series-controls input:checked",
                      ) ?? [],
                    )
                      .map((input) => input.parentElement?.textContent)
                      .join("; ") +
                    (el.parentElement?.textContent?.includes(
                      "B clean-filter baseline",
                    )
                      ? ". A current: solid with squares; B baseline: dashed with hollow circles."
                      : ""),
                  url: canvas.toDataURL("image/png"),
                },
              ]
            : [];
        });
      const scenario = document.querySelector<HTMLElement>(
        "main .recommendation-card",
      )?.innerText;
      setPreview({
        ...props,
        summary: props.summary + (scenario ? "\n" + scenario : ""),
        rows: structuredClone(props.rows),
        quality: [...props.quality],
        capturedAt: new Date().toISOString(),
        images,
      });
      setError("");
    } catch {
      setError(
        "Could not capture the chart. Keep the trend visible and try again.",
      );
    }
  }
  return (
    <>
      <button
        ref={button}
        className={open ? "" : "primary-action"}
        onClick={() => {
          setOpen(true);
          setPreview(null);
        }}
      >
        Build Report
      </button>
      {open &&
        createPortal(
          <div id="report-portal">
            <aside
              className="report-drawer"
              role="dialog"
              aria-modal="false"
              aria-label="Build report"
            >
              <header className="report-controls">
                <h2>Build report</h2>
                <button
                  ref={closeRef}
                  aria-label="Close report"
                  onClick={() => {
                    setOpen(false);
                    button.current?.focus();
                  }}
                >
                  Close
                </button>
              </header>
              <div className="report-controls">
                <p>
                  {props.asset} · {props.period}
                </p>
                <label className="editor-field">
                  Engineer notes
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button onClick={capture}>
                  {preview ? "Refresh report preview" : "Preview report"}
                </button>
                {error && <p role="alert">{error}</p>}
                <p>
                  Preview freezes the current data and charts. Refresh after
                  changing the page behind this drawer.
                </p>
              </div>
              {preview && (
                <article
                  className="report-document"
                  aria-label="Report preview"
                >
                  <h1>Ferriq engineering report</h1>
                  <p>{preview.asset}</p>
                  <p>
                    {preview.period}
                    <br />
                    Captured {preview.capturedAt}
                  </p>
                  <section>
                    <h2>Executive summary</h2>
                    <p>{preview.summary}</p>
                    <p>Source: {preview.source}</p>
                  </section>
                  <section>
                    <h2>Asset health and calculated values</h2>
                    <DataTable
                      rows={preview.rows}
                      caption="Report measurements"
                    />
                  </section>
                  <section>
                    <h2>Trend charts</h2>
                    {preview.images.length ? (
                      preview.images.map((img, i) => (
                        <figure key={i}>
                          <img src={img.url} alt={img.title} />
                          <figcaption>{img.title}</figcaption>
                        </figure>
                      ))
                    ) : (
                      <p>
                        No chart was visible when this preview was captured.
                      </p>
                    )}
                  </section>
                  <section>
                    <h2>Data-quality notes</h2>
                    {preview.quality.length ? (
                      <ul>
                        {preview.quality.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        No additional data-quality flags were reported for this
                        view.
                      </p>
                    )}
                  </section>
                  <section>
                    <h2>Engineer notes</h2>
                    <p className="report-notes">
                      {note || "No engineer notes added."}
                    </p>
                  </section>
                  <footer>
                    <p>
                      Engineering review aid. Reference limits are not operating
                      instructions. POC simulations and unvalidated assumptions
                      must not be treated as measured plant outcomes.
                    </p>
                  </footer>
                </article>
              )}
              <footer className="report-controls report-footer">
                <button
                  className="primary-action"
                  disabled={!preview}
                  onClick={() => window.print()}
                >
                  Export PDF
                </button>
                <p>Uses the browser print dialog. Choose Save as PDF.</p>
              </footer>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
