import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Player } from '../core/types';
import { NO_NUMBER, OUT_ANYWAY, OUT_WARNING, STOP_ASKING, WHOSE_NUMBER, playButtonText, type PlayType, type Toast } from './live-logic';

/** Bottom sheet over a dimmed backdrop; tapping the backdrop or pressing Escape closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="fixed inset-0 z-20 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        class="rounded-t-2xl border-t border-slate-600 bg-slate-800 p-3 pb-6"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 class="mb-2 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const ROW1: PlayType[] = ['FG2', 'FG3', 'FTM'];
const ROW2: PlayType[] = ['FTX', 'FOUL', 'TECH'];

interface Props {
  /** The picked player, or null for a team's + Play (then `title` names the team). */
  player: Player | null;
  /** The sheet's title when it is not a player's: `Away`. */
  title?: string;
  /** Only feedback produced while this sheet is open; the caller passes null for anything older. */
  toast: Toast | null;
  onPlay: (type: PlayType) => void;
  onUndo: () => void;
  onRedo?: () => void;
  onClose: () => void;
  /** Why the player is out (`5 fouls`), or null. An out player's plays are grayed until confirmed. */
  out?: string | null;
  /** The sub row at the foot (`#22 checks in` / `#10 comes out`), only for a team whose lineup is tracked. */
  subRow?: { text: string; onSub: () => void } | null;
}

export function EventSheet({ player, title, toast, onPlay, onUndo, onRedo, onClose, out = null, subRow = null }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const locked = out !== null && !confirmed;
  const btn = (t: PlayType) => (
    <button
      key={t}
      type="button"
      disabled={locked}
      // Word labels (FT missed, Tech foul) drop to text-xl so they stay one line in a 117px button.
      class={`min-h-14 rounded-xl bg-slate-600 font-bold active:bg-slate-500 disabled:opacity-30 ${t === 'FG2' || t === 'FG3' ? 'text-2xl' : 'text-xl'}`}
      onClick={() => onPlay(t)}
    >
      {playButtonText(t)}
    </button>
  );
  return (
    <Sheet title={title ?? (player ? `#${player.number} ${player.name}`.trim() : '')} onClose={onClose}>
      {locked && (
        <div class="mb-3 rounded-lg border border-red-500 bg-slate-900 p-3" role="alert" data-testid="out-warning">
          <p class="font-semibold text-red-300">Out: {out}. {OUT_WARNING}</p>
          <button
            type="button"
            class="mt-2 min-h-11 w-full rounded-lg border border-red-400 font-semibold text-red-300"
            onClick={() => setConfirmed(true)}
          >
            {OUT_ANYWAY}
          </button>
        </div>
      )}
      <div class="grid grid-cols-3 gap-2">
        {ROW1.map(btn)}
        {ROW2.map(btn)}
      </div>
      <div class="mt-3 flex min-h-11 items-center justify-between gap-2">
        <span class="truncate text-sm text-slate-300" aria-live="polite" data-testid="sheet-status">
          {toast ? toast.text : ''}
        </span>
        <div class="flex gap-2">
          {toast?.canUndo && (
            <button type="button" class="min-h-11 rounded-lg border border-slate-400 px-4 font-semibold" onClick={onUndo}>
              Undo
            </button>
          )}
          {toast?.canRedo && onRedo && (
            <button type="button" class="min-h-11 rounded-lg border border-sky-300 px-4 font-semibold text-sky-300" onClick={onRedo}>
              Redo
            </button>
          )}
          <button type="button" class="min-h-11 rounded-lg bg-white px-5 font-semibold text-slate-900" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      {/* Below everything else and apart from it. Gray: an ordinary button. Its space is kept, hidden, when there
          is no row (an untracked team, an out player, + Play), so the plays sit at one height on every sheet. */}
      <div class={`mt-3 border-t border-slate-600 pt-3 ${subRow ? '' : 'invisible'}`} aria-hidden={subRow ? undefined : true}>
        <button
          type="button"
          class="block min-h-11 w-full rounded-lg border border-slate-400 font-semibold text-slate-200 active:bg-slate-700"
          disabled={!subRow}
          tabIndex={subRow ? undefined : -1}
          onClick={subRow?.onSub}
        >
          {subRow?.text ?? ''}
        </button>
      </div>
    </Sheet>
  );
}

interface WhoseProps {
  /** The play waiting for a number, as its no-number toast reads: `Away +2`. */
  play: string;
  /** Credits the number; returns an error to show (`At most 15 players.`), or null when done. */
  onSave: (number: string) => string | null;
  onNoNumber: () => void;
  onStopAsking: () => void;
  onClose: () => void;
}

/**
 * The prompt after a + Play: a typed number credits that player (and adds them to the team if new),
 * No number records the play for the team only, and Stop asking does that and skips the prompt for
 * the rest of the game. Closing it records nothing.
 */
export function WhoseNumberSheet({ play, onSave, onNoNumber, onStopAsking, onClose }: WhoseProps) {
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => setError(onSave(number.trim()));
  const secondary = 'min-h-12 rounded-xl border border-slate-400 px-3 font-semibold active:bg-slate-700';
  return (
    <Sheet title={WHOSE_NUMBER} onClose={onClose}>
      <p class="mb-2 text-sm text-slate-300">{play}</p>
      <form
        class="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (number.trim()) save();
        }}
      >
        <label class="sr-only" for="whose-number">Number</label>
        <input
          id="whose-number"
          class="min-h-12 w-24 min-w-0 rounded-lg border border-slate-500 bg-slate-900 px-3 text-xl font-bold text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          placeholder="#"
          inputMode="numeric"
          autoComplete="off"
          value={number}
          onInput={(e) => {
            setNumber(e.currentTarget.value);
            setError(null);
          }}
        />
        <button type="submit" class="min-h-12 flex-1 rounded-xl bg-white font-semibold text-slate-900 disabled:opacity-40" disabled={!number.trim()}>
          Save
        </button>
      </form>
      {error && <p class="mt-2 text-sm font-semibold text-red-300" role="alert">{error}</p>}
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class={secondary} onClick={onNoNumber}>{NO_NUMBER}</button>
        <button type="button" class={secondary} onClick={onStopAsking}>{STOP_ASKING}</button>
      </div>
    </Sheet>
  );
}
