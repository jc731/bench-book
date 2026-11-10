import { describe, expect, test } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  test('escapes commas, quotes and newlines', () => {
    const out = toCsv([['O"Neil, Jr.\nX', 'plain', 3]]);
    expect(out.slice(1)).toBe('"O""Neil, Jr.\nX",plain,3');
  });

  test('CRLF between rows, empty row is an empty line, BOM exactly once at the start', () => {
    const out = toCsv([['a', 'b'], [], ['c']]);
    expect(out).toBe('﻿a,b\r\n\r\nc');
    expect(out.split('﻿').length).toBe(2);
  });
});
