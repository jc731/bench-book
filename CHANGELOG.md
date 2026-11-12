# Changelog

All notable changes to Bench Book are listed here, in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) style.

## [Unreleased]

## [0.4.0] - 2026-11-12

- The quarter check asks for the game score after the quarter, the running score the book's Score by Qtr box holds, instead of the points scored in it. The app works out the quarter's own points and checks those, so a gap already noted in an earlier quarter is named but not counted again, and a quarter skipped earlier is checked together with the next one (for example "Q2–Q3").
- A typed score lower than an earlier quarter's, or higher than a later one's, is flagged and can't be saved.
- The Book CSV's score by period shows the running score after each period, as the book does, ending in Final. A period with nothing typed is the last typed score plus the app's points since, marked `*`, so it never runs backward. The Reconcile rows add Book total, App total and the periods each check compared.
- A check saved before this version loses its numbers and reads Not checked again; its note stays.
- Redo: after an Undo, the line above the bar (and the player sheet) offers Redo, which steps forward again one entry at a time. Entering anything new ends it.
- The End button is outlined in amber when it ends a quarter, and in red once it can end the game (Q4 and overtime). On the end-of-Q4 sheet, Start overtime is amber and End game is red.

## [0.3.0] - 2026-11-11

- A "How to use" page, from the ⋯ menu, explains the app in short sections, with three screenshots that are refreshed on every release. It works offline, screenshots included, and opening it keeps the game and Undo.
- The running score shows a one-line legend of its marks.
- One line above the bottom bar shows what just happened, for example "#12 +2 — bonus", and stays until the next entry instead of fading. A quarter still to check, or a game not yet exported, shows as a chip at the right of the same line, for example "Check Q1", without hiding the entry. Undo is on the bottom bar.
- After a reload the line reads "Last: #12 +2".
- A player's sheet shows only what was entered while it is open.
- A long entry on the line wraps to a second line instead of cutting off its end, and the Check and Not exported chips read their full text to screen readers, starting with the words on the chip.
- The bottom bar is one row: Timeout, Undo, Log, End Q and ⋯. All seven player cards fit on an iPhone 13 screen without scrolling.
- Bench tech moved from the bottom bar to a Bench card at the end of the player cards.
- After End game the status strip reads Final and the End Q button becomes Final ▸ (read as "Final" by screen readers). The separate "Game ended" bar is gone.
- The ⋯ menu's "Final / export" opens the Final screen without ending the game. Final offers "End game early" (with a confirm) while the game is live, and "Reopen game" once it has ended, even after a reload.
- The Final screen's footer is "Back to game" and "New game".
- Log rows look like buttons, and the Log lists the newest quarter and the newest play first. The quarter check's list stays oldest first, to walk beside the book.
- Tapping a Log row opens the fix directly, titled with the play, for example "Fix: #12 +2 · Q1", with Play, Player and Quarter groups and Delete at the bottom.
- Moving a play to another quarter is in the fix's Quarter group, with "Also move the plays after it" for a missed End Q.
- Moving plays forward past a quarter now places them at the start of the target quarter, ahead of its own plays. This changes their order in the Plays CSV.
- "Add a missed play before this" is gone. Add a missed play from the quarter check's "Add play to Q…"; it goes at the end of that quarter.
- The quarter check always shows its plays on a mismatch; the Hide/Show toggle is gone.
- Setup starts with the opponent, Home/Away and the roster, plus a "First time here? How to use" link. Date, team, coach, scorer, timekeeper and "Also keep their score" fold into Game details.
- "Also keep their score" is remembered from the last game.
- The roster no longer asks for positions; the Book CSV's POS column is left blank.
- "Clear saved roster" is in Game details and asks first.
- The iPhone home-screen tip and the version moved to How to use.
- Starting a new game over an exported one says "Exported ✓" and makes Discard the main button.
- An export counts only until the game changes. Any change after a file was saved (a play added, fixed, deleted or moved, a check or note saved, a quarter or the game ended, overtime started, Reopen, or Undo) marks that file "not saved yet" again and makes New game ask to export first. On an ended game, the Not exported chip comes back too.
- The quarter check scrolls far enough that its last rows clear the feedback line.

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
