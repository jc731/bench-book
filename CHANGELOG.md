# Changelog

All notable changes to Bench Book are listed here, in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) style.

## [Unreleased]

- Log is now **Book**, on the bottom bar. Its Players tab shows each player's points and fouls by quarter, for Home or Away, with Team and Score rows; its Plays tab is the old Log. Book remembers the tab and the team until the app reloads. Tap a quarter cell to see that player's plays in that quarter (tap one to fix it) and add a missing play to that quarter in one tap. A 5th foul added late says "Tell the official." in red, as on the live screen.
- The check's Add play now says "Tell the official." when it puts a player out, and asks before adding a play for a player who is already out.
- A play added to an earlier quarter from the check no longer moves that player onto the floor (audit 0.9.0 F1).

## [0.10.0] - 2026-11-19

- Cards look the same whether a player is on the floor or the bench: the bench tag, the amber Sub · 6 on and "now on the floor" are gone. Cards after the top five are a shade grayer (Home) or darker (Away).
- A sub swaps the two cards instead of regrouping the half: the incoming player takes the outgoing player's slot. That includes a forgotten sub: when a bench player came on by making a play and the scorer then picks who went out, the player who came on takes that slot.
- Final offers a Usage CSV: taps, plays, undos, redos, fixes and late adds for the game, with no names.
- More → Edit teams fixes names, numbers and both rosters mid-game, without recording a play. A player with plays, or on the floor, can't be removed (sub them out first).
- More → Experiments: an opt-in timeout clock (off by default). Taking a timeout shows a 60 or 30 second countdown above the bottom bar, with a note at halfway and Time at 0:00. A new game starts with no clock open, and turning the experiment off closes one.

## [0.9.2] - 2026-11-17

- Floor cards have darker outlines on the light Home half and lighter ones on the dark Away half, so the five on the floor stand out from the ghosted bench. Before, the bench outlines were the stronger ones. The colors are unchanged: still gray, with amber and red as before.

## [0.9.1] - 2026-11-17

- A double-tap on End no longer skips a quarter. For a second after an End, the End button, Undo and the Q4/OT sheet's choices ignore taps (they show dimmed), so the second tap of a double-tap cannot end the next quarter, end the game from the sheet the first tap opened, or undo the End. After that second, End and Undo work as before.
- Saving a quarter check whose score still doesn't match the book says so: "Saved Q1 check — app still 2 short" (or "1 over"), in the compare panel's words. A match still reads "Saved Q1 check".
- When our score matches but their typed score is off, the compare panel is amber and reads "Ours matches · theirs 1 off", not the green "✓ Matches". The quarter's status still follows our score alone; with their box blank, or none of their points recorded, the panel is as before.
- "Who went out?" and "Who came in?" say how many to pick under the title, "Home · 8 on · pick 3", and the count updates with each tap, so it is clear the sheet closes on the last pick.
- Book CSV: a team's plays with no number now have a row of their own, "No number" (NO. blank), after that team's player rows and inside TEAM TOTALS, with its fouls, techs, marks by quarter, 2's, 3's, FTA, FTM and TP. The rows now add up to the team's TP, and the fouls column to its team fouls less bench techs. A team with no such plays is unchanged.
- "Who went out?" no longer marks a player "likely". The same suggestion now reads "longest without a play", in plain lighter text with no box, so it reads as a hint and not an instruction; "just in" keeps its tag. How to use and its screenshot say the same.

## [0.9.0] - 2026-11-17

- The live screen shows who is on the floor. Each team's first five start; their cards are solid, and the rest of the roster is the bench: ghosted cards with a small gray "bench" tag. Nothing is hidden, and with 11 or more players the floor stays in view while only the bench scrolls. Cards are 60 px tall (64 px in 0.8), so ten players and the controls still fit each half.
- Subbing is optional. A bench player who makes a play (+2, +3, a free throw or a foul) goes on the floor on their own and nobody comes off; the line above the bar adds "· now on the floor". A tech, a play entered anyway for an out player, or a play with no number never moves anyone.
- A Sub button beside each team's + Play (none for a roster of five or fewer). It reads Starters until that team's first play (a timeout or bench tech isn't one), then Sub, or "Sub · 6 on" / "Sub · 4 on" when the floor isn't five: amber from the play that changed it until that team's next play, then gray.
- The sub sheet asks one question for the floor it finds: "Who went out?" when more than five are on (the player who just came in is marked "just in", and a guess is marked "likely", never acted on), "Who came in?" when fewer, and "Who's on the floor?" for Starters or a line change, with a live "5 on the floor" count and Done (which never requires five). "Who went out?" and "Who came in?" close themselves at five.
- A routine sub is three taps: the player checking in, "#22 checks in" at the foot of their play sheet (or "#10 comes out" on a floor player's), then their partner. The line reads "#22 (Home) in for #10", or "Home floor updated" for a bigger change, and Undo takes it back.
- A foul-out takes the player off the floor, and the line says what to do: "#12 Dana Morrow (Home) out, 5 fouls. Tell the official." Their sub is the Sub button's "Who came in?".
- The lineup changes no score, foul or count, and subs are in neither CSV nor the Log. Log fixes, Undo and plays added at the check recompute it, and moving plays to another quarter takes any sub among them along. Games saved before 0.9 start from their first five, so one already under way may open with more than five on the floor (everyone who has played); one Sub fixes it.
- How to use has a Subs section, with a screenshot of "Who went out?".
- Demo mode for development and showing the app off: open the app with `?demo` (or run `pnpm dev:demo`) and both rosters and team names are filled in with invented players. Demo keeps its own saved game and rosters, so a real game or roster is never touched. A small gray "Demo" strip shows at the top of every screen, and More has "Reset demo".

## [0.8.0] - 2026-11-16

- Both teams on one live screen. Home is always on the left with light cards and Away on the right with dark ones; a small US tag marks your team, the one thing that changes between a home night and an away night. Every play, for either team, is tap the player, then the play. The Opp +1/+2/+3 taps and the "Also keep their score" option are gone.
- Setup has a second roster for the other team: numbers, with names if you have them. Both rosters are optional. Yours still prefills from the saved roster; theirs is not saved, since the opponent changes every game.
- + Play, at the foot of each half, records a play without tapping a card. After the play, "Whose number?" asks who: a typed number credits that player and adds them to that team if they are new (a late arrival, or a mis-entered roster); No number records the play for the team only; Stop asking this game skips the question for that team from then on. Each team's Bench sheet now holds only the bench tech.
- Timeouts are per team, as buttons under each team's Bench card: `Full: 2`, `30s: 1`, and `OT: 1` in overtime, each showing what is left. One tap takes one. The bar's Timeout button is gone; the bar is Undo, Log, End Q, and ⋯.
- A timeout button at zero is grayed but still asks first ("Away has no full timeouts left. Are you sure?"), and Take one anyway records it.
- Both bonuses: each half's header shows that team's fouls, and the bonus badge in the strip at the top names the team that shoots ("Home shoots"), over its half.
- Every play names its team: in the line above the bar, the Log and each play sheet's title (`#4 (Home) +2`, `Away +2`, `Home bench tech`). The score reads "Score Home 2, Away 3" to screen readers.
- The Log's fix sheet has a Team choice, to move a play to the other team.
- The quarter check shows their score when any of their points were recorded: "Their score: book 22 · app 20 — 2 off" in amber, as a warning only (the quarter's status still follows your score). The team fouls and "Player fouls, whole game" show both teams once the other team has a roster or any plays (a game with only legacy opponent points lists yours).
- Add play to Q1 (and so on) stays on the quarter check after the score matches, so a missed foul can be added once the score is fixed. It works for either team: pick Home or Away (it opens on yours), then a player or No number, then the play.
- The Book CSV adds the other team's block (its players, team fouls, bench techs and timeouts) when any of their plays were recorded; a game with none exports as before. The Plays CSV has a new `side` column, `home` or `away`; the `team` column is unchanged.
- Light (home) cards: the 4-foul warning, OUT, and bench-tech colors use darker amber and red shades so they stay readable on white.
- Games saved before 0.8 open in the new layout; their opponent points still count toward their score.

## [0.7.0] - 2026-11-16

- The end-of-game button reads "End Q4" (and "End OT1"…) on one line. With a trailing "…" it wrapped on a phone and looked cut off.
- The quarter check labels the player foul list "Player fouls, whole game", apart from the quarter's team fouls, so the totals no longer read as that quarter's.
- New game: the Opponent field no longer shows the date as a gray placeholder that looked like a score. A line under it says "Left blank, the game is named 11-16".
- The 30-second timeout reads "30s" everywhere on screen, matching the timeouts-left count. The Book CSV is unchanged.
- The page has a favicon.

## [0.6.0] - 2026-11-16

- Colors have one job each. Amber now only warns (4 fouls, the bonus, a check that doesn't match, a file not saved). The action to take is blue: End Q1, Check, Undo, Redo, and the Check chip after a quarter. End Q4 and OT stay red. A player's first three fouls show as gray dots, turning amber at the 4th.
- Start game and the new-game screen's main button are white, like every other main button.
- The Final score shows one team per row with its score at the right, so a long team name wraps inside its own row instead of splitting the score.
- Book CSV and Plays CSV are equal-weight buttons, since the coach wants both.
- The quarter check no longer opens with the End-of-quarter notice covering the plays to fix. Plays added from the check still show their notice.
- The check's "Not checked" status is an outline, so it no longer looks like a button.
- An out player's card keeps its OUT label, red dots and red border at full strength; only the number, name and points are grayed. The OUT label had been the hardest thing on the card to read.

## [0.5.0] - 2026-11-16

- The opponent is optional and moved into Game details. Left blank, the game is named for its date as MM-DD (for example `11-13`), on screen and in both CSVs. Home/Away now has the top row to itself.
- A player who is out (5 fouls or 2 techs) has a grayed card. Tapping it opens the sheet with every play grayed out and the warning "Are you sure? This player is supposed to be out.", and "Enter a play anyway" unlocks it for that one visit.
- The Bench card is now "Bench / coach tech", so it no longer reads as editing the roster, and it fills the rest of its row: beside the last player with an odd roster, the full width with an even one. It shows how many techs there have been (for example `1 tech`, outlined in amber), and the Bench sheet says the game's count.
- The screen stays on during a live game, on every screen from Live to the quarter check, where the browser allows it (Chrome on Android; Safari 16.4 and later). It turns off again once the game ends.

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
