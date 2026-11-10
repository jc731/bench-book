export type Cell = string | number;

function cell(v: Cell, guard: boolean): string {
  let s = String(v);
  if (guard && typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// RFC 4180: CRLF line ends, quotes doubled. One UTF-8 BOM at the very start so Excel
// reads accents correctly. An empty row ([]) is an empty line.
// `guard` prefixes text cells starting with = + - @ with ' so spreadsheets don't run them as
// formulas. Numbers are never touched, so a diff of -2 stays -2.
export function toCsv(rows: Cell[][], opts: { guard?: boolean } = {}): string {
  return '\uFEFF' + rows.map((r) => r.map((c) => cell(c, opts.guard ?? false)).join(',')).join('\r\n');
}
