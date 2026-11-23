import { bonusText, stripPeriodText, type TeamTag } from './live-logic';

/** One team's side of the strip: its tag, its score and whether it shoots in the bonus. */
export interface StripSide {
  tag: TeamTag;
  score: number;
  shoots: boolean;
}

interface Props {
  /** The team whose half is on the left (Home, or ours with "Our team on the left" on), then the right. */
  left: StripSide;
  right: StripSide;
  period: number;
  /** An ended game shows `Final` in place of the period. */
  ended: boolean;
}

const badge = (tag: TeamTag) => (
  <span class="whitespace-nowrap rounded bg-amber-400 px-2 text-xs font-bold leading-5 text-slate-900">{bonusText(tag)}</span>
);

// One line that must fit 390px without wrapping: the left team's bonus badge over the left half, the
// score (left–right, in the halves' order) and the period in the middle, the right team's badge over
// the right half. Each half's own header carries its team fouls, and its timeout buttons say what is left.
export function StatusStrip({ left, right, period, ended }: Props) {
  return (
    <header class="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-700 bg-slate-950 px-2 py-1">
      <div class="flex justify-start">{left.shoots && badge(left.tag)}</div>
      <div class="flex items-baseline gap-2">
        <div class="text-3xl font-bold tabular-nums" aria-label={`Score ${left.tag} ${left.score}, ${right.tag} ${right.score}`}>
          {left.score}–{right.score}
        </div>
        <div class="text-xl font-bold">{stripPeriodText(period, ended)}</div>
      </div>
      <div class="flex justify-end">{right.shoots && badge(right.tag)}</div>
    </header>
  );
}
