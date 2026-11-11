import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Player } from '../core/types';
import { playButtonText, type PlayType, type Toast } from './live-logic';

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
  player: Player;
  /** Only feedback produced while this sheet is open; the caller passes null for anything older. */
  toast: Toast | null;
  onPlay: (type: PlayType) => void;
  onUndo: () => void;
  onClose: () => void;
}

export function EventSheet({ player, toast, onPlay, onUndo, onClose }: Props) {
  const btn = (t: PlayType) => (
    <button
      key={t}
      type="button"
      // Word labels (FT missed, Tech foul) drop to text-xl so they stay one line in a 117px button.
      class={`min-h-14 rounded-xl bg-slate-600 font-bold active:bg-slate-500 ${t === 'FG2' || t === 'FG3' ? 'text-2xl' : 'text-xl'}`}
      onClick={() => onPlay(t)}
    >
      {playButtonText(t)}
    </button>
  );
  return (
    <Sheet title={`#${player.number} ${player.name}`.trim()} onClose={onClose}>
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
          <button type="button" class="min-h-11 rounded-lg bg-white px-5 font-semibold text-slate-900" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}
