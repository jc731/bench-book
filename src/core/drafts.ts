import { checkPeriod } from './reconcile';
import type { CheckDraft, Game } from './types';

const asText = (n: number | null) => (n === null ? '' : String(n));

export function checkDraftFor(g: Game, period: number): CheckDraft | null {
  return g.checkDrafts?.[period] ?? null;
}

/**
 * What the check screen opens with: the draft left by Later if there is one, else the saved record.
 * `appAtOpen` is the app's count when the check was FIRST opened, kept through a Later, so a quarter
 * fixed before the Later still saves as fixed.
 */
export function checkSeed(g: Game, period: number): CheckDraft {
  const draft = checkDraftFor(g, period);
  if (draft) return draft;
  const c = checkPeriod(g, period);
  return { us: asText(c.bookUs), opp: asText(c.bookOpp), note: c.note, appAtOpen: c.appUs };
}

/**
 * Stores or clears the draft for a period. Null, all-blank fields, or fields equal to the saved
 * record store nothing and clear any earlier draft. Returns the same game when nothing changes.
 */
export function setCheckDraft(g: Game, period: number, draft: CheckDraft | null, now: Date): Game {
  const c = checkPeriod(g, period);
  const blank = !draft || (draft.us.trim() === '' && draft.opp.trim() === '' && draft.note.trim() === '');
  const same = draft !== null
    && draft.us.trim() === asText(c.bookUs) && draft.opp.trim() === asText(c.bookOpp) && draft.note === c.note;
  const { [period]: _old, ...rest } = g.checkDrafts ?? {};
  if (blank || same) {
    if (!g.checkDrafts?.[period]) return g;
    return { ...g, checkDrafts: Object.keys(rest).length ? rest : undefined, updatedAt: now.toISOString() };
  }
  return { ...g, checkDrafts: { ...rest, [period]: draft }, updatedAt: now.toISOString() };
}

/** Whether the book number disagreed with the app as it stood when the check first opened. */
export function sawMismatch(bookUs: number | null, appUsAtOpen: number | null): boolean {
  return bookUs !== null && appUsAtOpen !== null && bookUs !== appUsAtOpen;
}
