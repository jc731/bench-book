export type Cell = string | number;

function cell(v: Cell): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// RFC 4180: CRLF line ends, quotes doubled. One UTF-8 BOM at the very start so Excel
// reads accents correctly. An empty row ([]) is an empty line.
export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
