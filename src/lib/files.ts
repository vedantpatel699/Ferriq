import Papa from "papaparse";
export function downloadFile(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    keys.map(cell).join(","),
    ...rows.map((r) =>
      keys
        .map((k) =>
          cell(
            typeof r[k] === "object" && r[k] !== null
              ? JSON.stringify(r[k])
              : r[k],
          ),
        )
        .join(","),
    ),
  ].join("\r\n");
}
export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  if (result.errors.length) throw Error(result.errors[0].message);
  const [rawHeaders, ...rows] = result.data;
  const headers = rawHeaders?.map((h) => h.trim());
  if (
    !headers?.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw Error("CSV needs unique nonempty column headers.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw Error(
        `Row ${i + 2} has ${r.length} columns; expected ${headers.length}.`,
      );
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
