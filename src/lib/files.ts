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
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((s) => s.replace(/^\uFEFF/, "").trim());
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new Error("CSV needs unique column headers.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(
        `Row ${i + 2} has ${r.length} columns; expected ${headers.length}.`,
      );
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
