import type { Feedback } from './live-logic';

const amber = 'min-h-11 w-full bg-amber-400 px-3 text-left text-sm font-semibold text-slate-900';

interface Props {
  line: Feedback;
  /** Positioning and border for the screen it sits on. */
  class?: string;
  /** Opens the check the prompt names. */
  onPrompt?: (period: number) => void;
  /** Opens Final, for the not-exported warning. */
  onExport?: () => void;
  /** Given, an undoable entry gets its own Undo (Log and the check). Live passes none: its bar's Undo is the line's. */
  onUndo?: () => void;
  /** Shown in place of an empty line. */
  idleText?: string;
}

/**
 * The one feedback line, shared by Live, Log and the quarter check. It stays until the next entry.
 * Its text is `#feedback-text`, so a button elsewhere can point `aria-describedby` at it.
 */
export function FeedbackLine({ line, class: cls = '', onPrompt, onExport, onUndo, idleText }: Props) {
  const text = (t: string, extra = '') => (
    <span id="feedback-text" data-testid="feedback-text" class={extra}>{t}</span>
  );
  return (
    <div class={cls} role="status">
      {line.kind === 'prompt' ? (
        <button type="button" class={amber} onClick={() => onPrompt?.(line.period)}>{text(line.text)}</button>
      ) : line.kind === 'export' ? (
        <button type="button" class={amber} onClick={onExport}>{text(line.text)}</button>
      ) : (
        <div
          class={`flex min-h-11 items-center justify-between gap-2 px-3 font-semibold ${
            line.kind === 'entry' ? 'bg-slate-700' : idleText ? 'bg-slate-700 text-sm' : ''
          }`}
        >
          {text(line.kind === 'entry' ? line.text : idleText ?? '', 'truncate')}
          {line.kind === 'entry' && line.undoable && onUndo && (
            <button type="button" class="min-h-11 px-3 font-bold text-amber-300" onClick={onUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
