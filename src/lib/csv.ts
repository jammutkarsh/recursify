// Minimal RFC 4180 CSV: quoted fields, escaped quotes ("") and newlines inside quotes.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";

/** Import rows: a CSV with a header row (needs a "title" or "url" column), or just LeetCode links, one per line. */
export function importRecords(text: string): { rows: Record<string, string>[]; header: boolean } {
  const firstLine = text.replace(/^\uFEFF/, "").trimStart().split(/\r?\n/, 1)[0] ?? "";
  if (/leetcode\.com\/problems\//.test(firstLine)) return { header: false, rows: parseCsv(text.replace(/^\uFEFF/, "")).map((r) => ({ url: (r[0] ?? "").trim() })).filter((r) => r.url) };
  const rows = csvRecords(text);
  if (rows.length && !("title" in rows[0]) && !("url" in rows[0])) throw new Error('No "title" or "url" column found.');
  return { header: true, rows };
}

/** Rows as objects keyed by lower-cased header. */
export function csvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
