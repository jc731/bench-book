import type { Feedback, Prompt } from './live-logic';

interface Props {
  line: Feedback;
  /** Positioning and border for the screen it sits on. */
  class?: string;
  /** What the chip does: open the check it names, or Final for the not-exported warning. */
  onPrompt?: (prompt: Prompt) => void;
  /** Given, an undoable entry gets its own Undo (Log and the check). Live passes none: its bar's Undo is the line's. */
  onUndo?: () => void;
}

/**
 * The one feedback line, shared by Live, Log and the quarter check: the last entry on the left (it
 * stays until the next one) and a prompt chip on the right. Neither hides the other. A long entry
 * wraps to a second line rather than cutting its tail. The entry text is `#feedback-text`, so a
 * button elsewhere can point `aria-describedby` at it.
 */
export function FeedbackLine({ line, class: cls = '', onPrompt, onUndo }: Props) {
  const { entry, prompt } = line;
  const text = entry ? entry.text : '';
  return (
    <div
      class={`flex min-h-11 items-center gap-2 px-3 py-0.5 font-semibold ${entry ? 'bg-slate-700' : ''} ${
        entry ? '' : 'text-sm'
      } ${cls}`}
      role="status"
    >
      <span id="feedback-text" data-testid="feedback-text" class="min-w-0 flex-1 break-words leading-tight">{text}</span>
      {entry?.undoable && onUndo && (
        <button type="button" class="-mr-3 min-h-11 shrink-0 px-3 font-bold text-amber-300" onClick={onUndo}>
          Undo
        </button>
      )}
      {prompt && (
        <button
          type="button"
          class="min-h-11 shrink-0 rounded-lg bg-amber-400 px-3 text-sm font-bold text-slate-900 active:bg-amber-300"
          aria-label={prompt.text}
          onClick={() => onPrompt?.(prompt)}
        >
          {prompt.chip}
        </button>
      )}
    </div>
  );
}
