/** The one-line, plain-language "what's going on" headline for an
 *  equipment page — e.g. "Polytropic efficiency below rolling baseline
 *  and worsening" plus a sub-line with the supporting numbers. Only
 *  rendered when there's an actual finding to report; a quiet/normal page
 *  can omit this rather than manufacture a "nothing to report" headline. */
export function EngineeringFinding({
  headline,
  sub,
}: {
  headline: string;
  sub: string;
}) {
  return (
    <>
      <div className="finding">{headline}</div>
      <div className="finding-sub">{sub}</div>
    </>
  );
}
