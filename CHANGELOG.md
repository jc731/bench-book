# Changelog

All notable changes to Bench Book are listed here, in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) style.

## [Unreleased]

## [0.2.0] - 2026-11-11

- The Setup screen shows the app version.
- A play added to an earlier quarter (from the quarter check) now sorts with that quarter, so the running score and the Plays CSV's running totals stay right. Changing a play's quarter in the Log moves it to the end of its new quarter.
- The quarter check no longer fills in the opponent's score from the taps. The tap total shows only as a hint in the empty box, a blank box is never saved or compared as a book number, and the check says when the opponent was not compared.
- The Final screen tracks the Book CSV and the Plays CSV separately, shows whether each was saved, and says what each file holds. The game counts as exported, for the 72-hour warning and the New game prompt, only once both are saved. Export now sits at the top of the screen, and its toast no longer offers Undo.
- Reopening the app on a game with plays shows where it left off, for example `Resumed · last: #4 Player One +2`.
- After a reload the disabled Undo button explains that the history clears on reload and that plays are fixed in the Log.
- Clearer wording throughout. The status strip labels the score `Us` and `Them`, reads timeouts as `TO left: Full 3 · 30s 2`, shows `Team fouls 4` in amber one foul before the bonus, and the bonus pill reads `Bonus: they shoot FTs`. Player buttons read `FT made`, `FT missed` and `Tech foul`; the bottom bar reads `Bench tech`.
- The foul that puts a player out names them, for example `#12 Player Four foul — 5th, out`, and the 5th team foul adds `— bonus`.
- Player cards show points with a unit (`2 pts`), and screen readers hear `1 point` and `1 foul` in the singular.
- After Q4 the choices read `Start overtime` and `End game (no overtime)`.
- On the Final screen a quarter that was never checked offers `Check`; `Reopen` is for a quarter already noted or off.
- In the Log, `Insert before` is now `Add a missed play before this`, and the move action reads `Move to another quarter…` with a line naming the plays it moves.
- Setup reads `Also keep their score (Opp +1/+2/+3)` for opponent taps, and `Timekeeper` for the timer.
- The quarter check has one way out: `Later` or `Save` at the bottom. The header Later and the Check button are gone, and the comparison updates as you type. Leaving a field no longer saves; only Save does, and its toast keeps Undo.
- The check's top line puts the quarter first, for example `App has Q2: Us 8 · Them 6 (game 18–12)`, and a mismatch adds `Add the missing play, fix one below, or write a note and Save.`
- The plays list inside the check no longer has its own header and Back button.
- In the Book CSV's score by period, an opponent figure taken from the taps because the book box was left blank is now marked `*`, as our own estimates are, and so is the opponent total.
- The Book CSV's `Timer` column is renamed `Timekeeper`, to match Setup.
- The resume note no longer shows when reopening a game that has already ended.
- On the quarter check, `Later` keeps what you typed as a draft, even through a reload, and reopening that quarter fills it back in. A draft is not a check: the quarter still reads Not checked, the Book CSV ignores it, and only Save records the check. A quarter fixed before a Later still saves as Fixed.

## [0.1.0] - 2026-11-10

- Setup with a roster that is remembered on the device for the next game.
- Live entry of points, free throws, fouls and technicals, with undo for every entry.
- IESA/NFHS team fouls that reset each quarter, with the bonus shown on the 5th.
- Timeouts tracked from the bottom bar.
- A quarter check against the paper book that shows whether the app matches.
- A log of every entry, in order.
- A running score that updates as entries are made.
- Two CSV exports: the Book CSV and the Plays CSV.
- Works offline once loaded, and can be added to the home screen.
