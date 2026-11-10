export const UNDO_CAP = 50;

export interface UndoEntry<T> {
  snapshot: T;
  label: string;
}

/** Returns a new stack with the entry on top, dropping the oldest beyond the cap. */
export function pushUndo<T>(stack: UndoEntry<T>[], entry: UndoEntry<T>, cap = UNDO_CAP): UndoEntry<T>[] {
  const next = [...stack, entry];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Pops the newest entry (last in, first out). */
export function popUndo<T>(stack: UndoEntry<T>[]): { entry: UndoEntry<T> | null; stack: UndoEntry<T>[] } {
  if (stack.length === 0) return { entry: null, stack };
  return { entry: stack[stack.length - 1], stack: stack.slice(0, -1) };
}
