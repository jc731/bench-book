# Bench Book v1 — design

Date: 2026-11-10
Status: approved by owner 2026-11-10

## What this is, and why

Bench Book is a free, open-source web app for the person keeping the scorebook at a
junior high basketball game. It runs on that person's phone or tablet at the scorer's
table and tracks **one team only: ours**.

Today the official record is a paper **Murray Sporting Goods basketball scorebook**.
That doesn't change in v1. The bookkeeper taps each event into Bench Book and also
writes it in the book. The app's job is to give a second, independently kept record,
catch the moments where the book and the app disagree, and hand back a file that pairs
with the book page after the game.

Where this is headed (owner's framing). Only v1 is in scope here:

1. **v1: a digital Murray book.** It mirrors the paper page box for box.
2. **v2: an aid for updating the book later.** The book might be filled in only after
   each quarter, from the app.
3. **v3: a replacement for the book.** The app generates the book page itself.
4. Possibly later: a stats and analysis tool for coaches.

### Reference: the Murray page

Blank page:
<https://murraysportinggoods.com/cdn/shop/products/MurraySportingGoods_BasketballScorebook_Inside_1024x1024.jpg?v=1703016503>
Filled-out example with instructions:
<https://murraysportinggoods.com/cdn/shop/products/MurraySportingGoods_BasketballScorebook_Inside_FilledOut_1024x1024.jpg?v=1703016503>

A page covers one team and has:

- **Header:** Team, Coach, Date, Scorer, Timer, plus bench technicals T1–T3.
- **Running score:** 1–112. Each score is marked `/` for a free throw, `X` for a 2, and
  a filled dot for a 3, with the jersey number written by it.
- **Score by Qtr:** rows A (away) and H (home), with columns 1st, 2nd, 3rd, 4th, 1OT,
  2OT, Total.
- **Player rows (15):** POS, PLAYER, NO., personal fouls 1–5 plus T1/T2 for player
  technicals, period cells for 1st–4th QTR, 1st OT, 2nd OT (marked `2`, `3`, a
  crossed circle for a made FT, `0` for a missed FT), then FG 2'S, 3'S, FT FTA, FTM, TP.
- **Timeouts:** FULL 1–3, 30 SEC 1–2, OT 1–2.
- **Team fouls:** first half 1–10 and second half 1–10. *These boxes are out of date;
  see Rules.*
- **Team totals row.**

## Goals

- Recording an event is quicker than writing it in the book: one tap to pick the player,
  one tap to pick the event.
- A mis-tap is never a problem: there's an undo button, and any past event can be edited
  or deleted.
- The scorer always knows: the score, the period, team fouls and the bonus, timeouts
  left, and every player's foul count, with a warning at 4 and "out" at 5.
- At the end of each period, an easy reconcile step catches the cases where the book's
  period score ≠ the app's sum and records how each was resolved.
- The game survives a reload, a dead battery, or an accidental tab close.
- After the game, the scorer exports two CSV files: one laid out like the book, one
  raw play-by-play.
- After the first visit, the app works with no network. Gym wifi is unreliable.

## Non-goals (v1)

- Tracking opponent players. The opponent is a score per period and nothing more.
- Tracking who is on the court, and substitutions. With a 7-player roster a single list
  is fine. (Backlog.)
- Missed field goals, rebounds, assists, turnovers, steals, blocks. (Backlog.)
- A game clock or shot clock.
- Accounts, a server, sync, sharing, or season history.
- Enforcing the rules. The app warns but never blocks an entry. The officials decide.
- Configurable rule sets. v1 has IESA/NFHS built in. (Backlog.)
- Printing or rebuilding the actual book page. (That's v3.)

## Anti-goals: things that make it a failure even if it "works"

- **The bookkeeper misses a play** because the app needed attention: a modal they had to
  close, a confirmation they had to answer, a reconcile step that blocked the next period.
- **Game data is lost** partway through a game.
- **Kids' names leave the device.** No analytics, no third-party scripts, no network calls
  carrying game data. The roster is personal data about minors.
- **The app disagrees with the book silently.** A mismatch is always shown and always
  either resolved or noted.
- **Roster data gets into the repo.** The repo is public. Names and numbers are entered on
  the device and stay there.

## Rules (IESA, which follows NFHS)

Our team plays junior high under Illinois IESA, which follows NFHS. These rules are
built into v1:

- **Team fouls: counted per quarter and reset at the start of each quarter.** The bonus
  (two shots) starts at the **5th team foul in a quarter**. Overtime is an extension of
  the 4th quarter, so the 4th-quarter count carries into every OT period. (IESA rule
  change, effective 2023–24. This replaces the book's "per half, 1–10" boxes.)
- **What counts toward team fouls:** every personal foul and **every technical foul**,
  whether a player's or a bench technical (the book's T1–T3 boxes). The NFHS Case Book
  rules that a technical on a team member, *including bench personnel*, "is added to the
  team foul total" (case plays 4.19.x, 10.5.1). An *indirect* technical on the head coach
  is a consequence of a foul that has already been counted, so it isn't counted again. v1
  doesn't record indirect technicals. *Source: the owner's `nfhs-basketball-casebook`
  repo. That text predates the 2023 change to the bonus, but this rule wasn't part of it.
  (My call, settled from that source.)*
- **Player fouls:** a technical counts as a personal foul, as the Murray instructions
  say. Show a warning at 4. At 5, mark the player **out**, but still accept entries,
  because the scorer may have charged the wrong player.
- **Timeouts:** these mirror the book: Full ×3, 30-sec ×2, plus one extra timeout per
  OT period. The app shows 2 OT boxes, as the book does, and adds more if the game goes
  past 2OT. Unused regulation timeouts carry into OT. Marking a timeout as used is never
  blocked.
- **Periods:** Q1–Q4, then as many OT periods as the game needs.

## How it works

### Before the game: setup

- Game info: our team name, opponent, date, home or away, coach, scorer, timer. All
  optional except the opponent.
- Roster: up to 15 players, each with position (optional), name, and jersey number
  (required, unique). Jersey numbers are text, so `0` and `00` are different numbers.
- **The device remembers the last roster** in browser storage, so next week the scorer
  confirms it rather than retyping it. There's a "clear saved roster" control. The roster
  never goes anywhere else.

### During the game: live entry

- The main screen is mobile-first and works in portrait on a phone. A tablet gets a roomier
  layout.
- **The player list:** every player as a large button, with the jersey number largest, the
  name, the player's points so far, and foul dots. Players at 4 fouls are visibly flagged,
  and players at 5 show as out.
- **Events per player:** 2-pt made, 3-pt made, FT made, FT missed, personal foul,
  technical foul.
- **Team events:** timeout (Full / 30 / OT), bench technical, end period.
- **Opponent:** quick +1 / +2 / +3 buttons keep a live opponent total, so the scoreboard on
  screen is useful. These buttons are optional. The opponent's period score is confirmed at
  the reconcile step either way. *(My call. The owner said "my team only," but the book's
  Score by Qtr box has both teams.)*
- **A status strip, always visible:** both scores, the period, our team fouls this period
  (flagged "opponent in bonus" from our 5th), and our timeouts left by type. *(v1 tracks
  only OUR fouls, so whether WE are in the bonus is left to the officials and the book.)*
- **Undo** reverses the last event. A **log** view lists every event, newest first. Any
  event can be edited (player, type, period) or deleted, and every running total
  recalculates.
- **Running score view:** a 1–112 grid like the book, filled in from the order the events
  were entered, using the book's marks and the jersey number. A period boundary is marked
  in the grid.

### At the end of each period: the reconcile step

When the scorer taps "end period":

1. The app asks for **our period score as written in the book** and **the opponent's
   period score**. The opponent field is prefilled from the live buttons, if those were
   used.
2. It compares our book score with the sum of that period's player events.
3. **If they match:** done. The next period starts.
4. **If they differ:** the app shows the difference ("book 12, app 10, app is 2 short")
   and that period's events. The scorer can do one of three things:
   - **Fix the app:** add, edit, or delete events until the numbers agree.
   - **Accept with a note:** e.g. "book was wrong, corrected book" or "unsure, #23 may
     have had a 2."
   - **Do it later:** the period is flagged "unresolved" and the game goes on. This option
     always exists. The reconcile step can never block the next period.
5. The resolution (matched / fixed / noted / unresolved) and any note are stored with the
   period and included in the export.

There is **no separate running-score check.** The app builds its grid from its own events,
so the grid's last mark always equals the app's sum, and comparing them proves nothing.
The book's own running score is the scorer's business. *(My call.)*

**Inserting a missed event.** When fixing a period, the scorer can insert an event
*before* an existing one, not just append it at the end. Then the running-score grid and
the plays CSV follow the order the plays actually happened. Events therefore carry an
explicit order, separate from their entry timestamp, which is also kept. *(My call.)*

### After the game

- **"End game"** runs a final reconcile. It lists every unresolved period and asks the
  scorer to resolve each or add a note. A note like "left unresolved" is allowed.
- **Export:** two CSV files, downloaded to the device.
  1. **`bench-book_<date>_<opponent>_book.csv`, laid out like the Murray page:** a header
     block (team, opponent, date, home/away, coach, scorer, timer), then one row per player
     (POS, NAME, NO., fouls, technicals, points per period, the period marks as text e.g.
     `2 2 FT 0`, then 2'S, 3'S, FTA, FTM, TP), a team totals row, team fouls per period,
     timeouts used, bench technicals, score by period for both teams, and the reconcile
     status and note for each period.
  2. **`bench-book_<date>_<opponent>_plays.csv`, play by play:** one row per event, with
     sequence number, period, team (us/opponent), jersey number, player name, event type,
     points, our running score, the opponent's running score (if tracked), the time of
     entry, and whether it was edited.
- Exporting can be repeated as often as wanted.
- **Who reads them:** a person, in Excel, Google Sheets or Numbers. So the book-layout file
  is deliberately *not* one rectangular table. It's separate blocks with a blank row between
  them, and it reads like the page. The plays file *is* a single clean table, and it's the
  one future versions will read back in. v1 has **no import or restore from a file**.
  *(My call.)*
- **Opponent score:** the period score confirmed at the reconcile step is the record. The
  live +1/+2/+3 taps are a convenience. They appear in the plays CSV as opponent events, and
  if a confirmed period total disagrees with them, that period's row notes the difference.
  No events are invented to make them agree. *(My call.)*

### Saving

- Every event is written to browser storage (`localStorage` or IndexedDB) the moment it
  happens.
- On reload, an unfinished game resumes exactly where it left off.
- **Game data is cleared 72 hours after the game's last change.** That covers a finished
  game too: export before then. Before the cutoff, the app reminds the scorer if a finished
  game hasn't been exported.
- There's one game at a time on a device. Starting a new game while one exists asks for
  confirmation and offers to export first.
- The saved roster is kept until the scorer clears it. The 72-hour rule doesn't apply to it.
- **Known limitation, recorded and not built for:** iOS Safari may delete a site's saved
  data after about 7 days without a visit. A weekly game sits right at that line, so a saved
  roster could vanish. The cost is retyping about 7 players, roughly a minute. An unfinished
  game is not at risk, because it's within 72 hours. The setup screen suggests "Add to Home
  Screen" on iOS, which exempts the app from that clearing. **Trigger to build a roster
  backup:** a scorer reports losing the roster before a game, or the roster grows past what
  is quick to retype. *(My call.)*
  **Owner (2026-11-10):** "Add to Home Screen" is the preferred answer. It keeps Bench Book a
  very simple web app. If the trigger above fires, the options are a roster import (a small
  team file) or, much heavier, a login. Prefer the import.

## Decisions already made

| Decision | Choice | By |
|---|---|---|
| Name | **Bench Book**; repo `jc731/bench-book` | owner |
| License | **MIT** | owner (agreed after recommendation) |
| Hosting | **Netlify**, static | owner |
| Stack | **Astro + Tailwind + pnpm**, static output, no server | my call (matches the owner's other sites) |
| Login / server | none | owner |
| Storage | on the device only, with a 72 h retention for game data | owner |
| Roster | entered on the device, never in the repo | owner |
| Rules | IESA/NFHS built in | owner |
| Exports | two CSVs, book layout + play-by-play | owner |
| Works offline | yes, as a PWA with a service worker | my call |
| Data model | **an event log is the source of truth**; every total, the running score, the reconcile view and both exports are computed from it | my call — undo, editing, reconciling and play-by-play all come for free from it, and v2/v3 (book generation, stats) build on the same log |
| Opponent live score | optional +1/+2/+3 buttons | my call |

## Left to the builder

- The UI framework inside Astro (vanilla TS, Preact, Svelte…). Keep the bundle small. The
  app should load fast on a phone over a poor connection the first time.
- `localStorage` or IndexedDB.
- Exact visual design, within: big tap targets (≥ 44 px), high contrast for bright gyms,
  usable with one thumb.
- How the reconcile step and the log view look.
- Tests: the event log, the computed totals, team fouls and the bonus, the reconcile
  comparison and both CSV exports are pure logic. Test them with Vitest. A Playwright
  smoke test of a scripted game is welcome.
- The PWA setup (manifest, icon, service worker approach).

## Backlog (not v1)

- **Configurable rule sets** (IESA/NFHS by default; others such as a local rec league's
  per-half fouls). The owner asked for this to be noted.
- **Push notifications to the coach's smartwatch:** foul counts, a player at 4 fouls, the
  bonus, timeouts left. The owner asked for this to be noted. It needs some kind of
  delivery path, since there's no server today.
- **On-court five and substitutions.**
- **More stats:** missed FGs, rebounds, assists, turnovers, steals, blocks.
- **v2:** update the book after each quarter from the app.
- **v3:** generate and print the book page.
- Season stats and analysis across games (this would need the owner to decide on storage).
- Tracking opponent players.
