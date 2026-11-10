import { describe, expect, it } from 'vitest';
import { popUndo, pushUndo, UNDO_CAP, type UndoEntry } from './undo-stack';

const e = (n: number): UndoEntry<number> => ({ snapshot: n, label: `#${n}` });

describe('undo stack', () => {
  it('pops in last-in-first-out order', () => {
    let s: UndoEntry<number>[] = [];
    s = pushUndo(s, e(1));
    s = pushUndo(s, e(2));
    s = pushUndo(s, e(3));
    const a = popUndo(s);
    expect(a.entry?.snapshot).toBe(3);
    const b = popUndo(a.stack);
    expect(b.entry?.snapshot).toBe(2);
    expect(popUndo(b.stack).entry?.snapshot).toBe(1);
  });

  it('returns null entry on an empty stack', () => {
    expect(popUndo<number>([]).entry).toBeNull();
  });

  it('caps at 50, dropping the oldest', () => {
    let s: UndoEntry<number>[] = [];
    for (let i = 0; i < UNDO_CAP + 10; i++) s = pushUndo(s, e(i));
    expect(UNDO_CAP).toBe(50);
    expect(s).toHaveLength(50);
    expect(s[0].snapshot).toBe(10);
    expect(s[49].snapshot).toBe(59);
  });

  it('does not mutate the input stack', () => {
    const s = [e(1)];
    pushUndo(s, e(2));
    expect(s).toHaveLength(1);
  });
});
