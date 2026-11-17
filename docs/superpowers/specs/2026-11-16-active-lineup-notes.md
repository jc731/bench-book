# Active lineup (0.9): starting notes

Status: direction agreed with the owner, 2026-11-16. Not yet a design: the next session starts the
design pass (brainstorming, mockups) from here.

## What the owner decided

- **0.9 is the active lineup**, the next item on the 1.0 checklist (`CLAUDE.md`).
- **Nothing is hidden.** Every player keeps a card. The five on the floor sit at the top of their
  half, and the bench sits below. A sub moves a player between floor and bench.
- **Subbing is optional.** A scorer who never subs gets today's screen. A missed sub costs nothing,
  because the player who scored is still one tap away.
- First-time scorers will expect subs once space for cards is limited, which is why the item stays
  on the 1.0 list. Reordering rather than hiding is what makes it low-risk.

## Carried from the 1.0 checklist

- A fouled-out player prompts a sub. It suggests a swap and never forces one.
- Large rosters (11 to 15): the floor five stay in view and only the bench scrolls inside its half.

## Open questions for the design pass

- **The sub interaction:** drag, a swap sheet (tap a bench player, then the floor player going
  out), or tap-and-hold. Mockups settle it, on the iPhone 13 profile.
- **Starting five:** set in Setup, at tip-off, or "the first five tapped"? What does the screen
  show before any sub?
- **Order within the floor and the bench:** by number, by entry, or kept where the scorer put them.
- **How a sub is recorded:** as an event (in the Log, undoable, in the Plays CSV) or as screen
  state only. The paper book does not track the lineup, so the CSVs may not need it.
- **Both teams or ours only:** the other team's lineup costs the scorer taps; maybe an option.
- **The audit's scripted game:** add sub events (a routine sub, a sub forced by a foul-out, and a
  play credited to a bench player) in the same release, to test whether subbing is obvious.

## Measured facts to design against

- iPhone 13: each half is 506 px with 10 cards (88.5 × 64 px), + Play and Bench (32 px each) and
  timeout buttons (40 px), with about 6 px to spare (0.8, Task 6).
- The live screen's halves are `TeamHalf` (`src/ui/TeamHalf.tsx`). Live owns the event logic.
