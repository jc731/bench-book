# Active lineup and demo mode (0.9)

Status: agreed with the owner 2026-11-17 (decisions 2a, 11a and 19 are Claude's calls from the builder check, for the owner to check) after two critique rounds (9 critics: a veteran scorer, a
mobile interaction designer, an edge-case reviewer, a simplicity skeptic, a visual designer, a scenario
walkthrough, a guess-vs-ask judge, an engineer, a first-timer red team). Builds on
`2026-11-16-active-lineup-notes.md` and the 0.8 design (`2026-11-16-both-teams-design.md`).

## Why

The 1.0 checklist item: "Active lineup with substitutions: the five on the floor sit at the top of
their half, the bench below; a sub moves players between floor and bench, and nothing is ever hidden,
so subbing is optional. A fouled-out player prompts a sub." First-time scorers expect to sub once card
space is limited; rosters of 11–15 scroll inside a half; a foul-out should prompt a sub.

What the critics established, which shaped every decision below:
- The paper book records entries (starters, players who played) but **never who left**. A scorer who
  notices a forgotten sub usually does not know who it replaced.
- "Longest since last play" is close to random in junior-high ball (a defender can go minutes without a
  recorded play). An app that **acts** on that guess drops the wrong player, whose next play triggers
  another guess: the lineup ping-pongs.
- Real subs come in **batches** (quarter breaks, timeouts: 2–5 at once).
- On a 5th foul the scorer's job is to **tell the official**; the sub follows when a player checks in.
- The lineup affects **layout only**: scores, fouls and player lines never depend on it. A wrong lineup
  costs a card in an unexpected place, never data.

## Goals

- The five on the floor read at a glance in each half; the bench is visibly the bench, never hidden.
- A deliberate sub is the normal path and takes 3 taps; a line change is one sheet.
- A forgotten sub corrects itself enough to keep scoring, and fixing it is one or two taps when the
  scorer has a second — never a question at the moment of the play.
- Optional all the way down: a scorer who never subs is never blocked or nagged for long.
- Demo mode: a way to open the app with both rosters filled, for development and for showing it off.

## Non-goals (0.9)

- Recording the lineup in the CSVs or the Log (the book doesn't track it). Trigger to revisit: a scorer
  wants to review subs after the game.
- A per-team "don't track the lineup" setting. Trigger: a both-teams scorer finds the other team's Sub
  button noisy.
- An optional "Same five?" prompt at quarter starts. Trigger: line changes at breaks prove slow.
- Long-press or drag interactions (undiscoverable; collide with scrolling).

## Anti-goals

It fails, even if it works, if:
- the app moves a player OFF the floor on a guess;
- cards jump under the scorer's thumb in the middle of play;
- the scorer must answer a lineup question before entering the next play;
- the bench reads as "out" (gray already means out);
- demo mode overwrites a real saved roster or a game in progress.

## Approaches considered

1. **Guess and correct (the owner's first idea, "v1").** A bench player's play moves her to the floor
   and drops the floor player with the longest time since a play; the toast offers "Wrong one?".
   Rejected: the guess is mostly wrong in junior-high ball, a wrong drop seeds the next wrong guess, and
   it asks "was that right?" mid-play.
2. **Ask, don't guess ("v2").** Promote the bench player, drop nobody, show "6 on floor" and ask later.
   Honest, but every answer costs two taps, even when the answer is obvious.
3. **Ask, with a suggestion (chosen).** v2, plus the "Who went out?" sheet marks the likeliest player
   **"likely"**, so a right guess is one tap. The app never acts on a guess the scorer didn't tap.

Sub entry: a Sub row inside the play sheet (chosen for single subs: no new on-screen control, the thumb
is already there) **and** a per-team Sub button (chosen for line changes and discoverability). A
separate per-team swap screen alone was rejected (two models); long-press/drag rejected.

Lineup data: stored floor state (rejected: goes stale on every Log correction) vs. **derived by
replaying the plays, with deliberate subs stored as in/out lists** (chosen). Subs as absolute floor
sets were considered (idempotent) and rejected: after a Log correction removes a wrongly credited
player's promotion, a stored set would keep her on the floor; in/out lists are re-applied to the
corrected floor and skipped where they no longer apply.

Starters: a long-tap in Setup (rejected: undiscoverable); a Setup "Starter" tick per row (backlog);
**the same "Who's on the floor?" sheet before the first play, with the first five preselected**
(chosen: nothing new to learn).

Demo mode: a build-time flag only (rejected: can't use it in production); **a `?demo` URL parameter,
with a `dev:demo` script that opens it** (chosen).

## Decisions

### The floor

1. **Starters.** Each team's first five roster players start on the floor; a roster of five or fewer is
   all floor, with no bench and no Sub prompts. Before that team's first play, its Sub button reads
   **Starters**; it opens "Who's on the floor?" with the current five on. Ignored, the first five start.
2. **The lineup carries over** between quarters and into overtime.
2a. **Rosters that grow mid-game** (the other team's, built through Whose number?). The starters are
    the first five on the roster in roster order, which is the order players were added. So until a
    team has five players, everyone added is on the floor and nothing prompts; the sixth and later
    players start on the bench and come on by playing (decision 3). A team built mid-game therefore
    shows "Sub · 6 on" (amber) when its sixth player first plays — true, and it turns gray after that
    team's next play. *Builder-check answer; Claude's call.*
3. **Promotion.** A play by a bench player — +2, +3, FT made, FT missed, Foul — puts her on the floor.
   **Nobody leaves.** The floor can show 6 or more. These never promote: a Tech foul (bench players
   get techs), a play entered anyway for an out player, a play with no number. A player added mid-game
   through + Play → Whose number? made a play, so she is promoted by the same rule.
4. **Foul-out.** A player who reaches 5 fouls or 2 techs leaves the floor at that play (certain by
   rule). Toast: **"#12 (Home) out, 5 fouls. Tell the official."** (or "2 techs"). Her card shows as
   out, on the bench side.
5. **The floor is derived** by replaying the game for each team: starters (or the Starters sub), then
   every play and sub in order — promotions, foul-outs, subs. So Undo, Redo, Log fixes, deletes, moves
   to another team or quarter, and plays added from the check all recompute it. A play added from the
   check or the Log that is by a bench player promotes her too (if she played, she was in).

### Subs

6. **Stored as in/out lists.** A sub records the players who went in and who came out, anchored in the
   same order as the plays. On replay, an "in" already on the floor or an "out" already off it is
   skipped; players no longer on that team's roster are ignored. Undo covers subs (whole-game
   snapshots). Subs are not plays: they never appear in the CSVs, the Log, the running score or any
   count of plays.
7. **From a player's play sheet (the normal single sub).** At the foot of the sheet, below the plays
   and separated from them: for a bench player **"#22 checks in"**, for a floor player **"#10 comes
   out"**. Tapping it opens the sub sheet in the matching mode with that player already moved. Then one
   tap on the partner closes it. **3 taps** in all.
8. **The team's Sub button** sits beside + Play, at least 44 px tall. Labels: **Starters** (before the
   first play), **Sub** (floor is 5), **Sub · 6 on** / **Sub · 4 on** (floor isn't 5). Amber when the
   floor isn't 5, from the play that changed it until that team's next play; gray after that, still
   showing the count. It opens the sub sheet in the mode the floor needs.
9. **The sub sheet**, titled for its mode, for one team:
   - **"Who went out?"** (floor above 5): lists the floor, with the player who just came in marked
     **"just in"** and the suggestion marked **"likely"**. Tapping a player takes her off; the sheet
     closes when the floor reaches 5 (more taps if it was 7+).
   - **"Who came in?"** (floor below 5): lists the bench; tapping a player puts her on; closes at 5.
   - **"Who's on the floor?"** (floor is 5, or Starters): every player as a large toggle, on = on the
     floor, grouped "On the floor" / "On the bench", a live count **"5 on the floor"** (green at 5,
     neutral otherwise), and **Done**. Done never requires exactly 5.
   - Out players show grayed with their reason and can't be put on (no override in 0.9).
   - Cancel or the backdrop records nothing.
10. **The suggestion ("likely").** The player who came out of the floor least recently active: an out
    player first, then the longest since her last play, ties to the lowest card. It is only a label; it
    never acts.

### On screen

11a. **With 11–15 players the floor stays in view and only the bench scrolls** (the owner-approved
    1.0 checklist wording). The floor cards sit in a fixed block at the top of the half; the bench
    scrolls in its own region below; + Play / Sub, Bench and the timeouts stay put. A promoted bench
    player stays where she is in the bench region (she was just tapped, so she is in view) until the
    next sub regroups the half. *Builder-check answer; Claude's call, following the checklist.*

11. **Cards don't jump mid-play.** A promoted player turns solid where she is; a foul-out turns out in
    place. The half regroups (floor first, then bench) only when a sub is recorded, which is a moment
    the scorer chose, thumb off the grid. Between subs, card order is the order at the last sub (or the
    start).
12. **Floor and bench look different without a new color.** Floor cards are solid, as today. Bench
    cards are **ghosted**: the half's own background, a 1 px border, text at full strength, and a small
    gray **"bench"** tag where an out player shows red OUT. Out stays as today (grayed, red border, OUT).
    Bench-only rows may be shorter (at least 44 px) so ten players plus the controls still fit.
13. **Toasts.** A promotion appends **"· now on the floor"** to the play's toast ("#22 (Home) +2 · now
    on the floor"). A sub: **"#22 (Home) in for #10"** for one swap, "Home floor updated" for several.
    A foul-out: as in decision 4. Undo labels name the sub.
14. **Both teams** follow the same rules. A team with no numbered players has no lineup and no Sub
    button prompts.
15. **Games saved before 0.9** have no subs: their floor replays from the first five and their plays.

### Demo mode

16. **`?demo` in the address** opens Setup with both rosters and team names filled with invented
    players (the repo is public). It works in production as well as development.
17. **Demo data lives in its own storage.** A demo game and its rosters use separate storage keys, so a
    real saved roster or a game in progress on that phone is never read or overwritten; opening the app
    without `?demo` shows the real data untouched.
18. **`pnpm run dev:demo`** starts the dev server and opens `/?demo`.
19. **How long demo lasts.** The flag lives only in the address: with `?demo` the app uses demo storage,
    without it the real one (a reload keeps the address, so a demo survives a reload; an installed app
    launched from the home screen opens the real data). The demo game in progress resumes like a real
    one. While in demo, a small **"Demo"** marker shows on every screen (gray, so it adds no color job),
    and the More menu offers **"Reset demo"**, which clears demo storage and refills the rosters. The
    marker is what keeps a real game from being scored in demo by mistake. *Builder-check answer;
    Claude's call.*

## Constraints

- One thumb, phone (iPhone 13, 390 × 664). Tap targets at least 44 px.
- Colors have one job each (`README.md` § Colors). Amber = caution, gray = everything else, red = out,
  blue = the action to take, green = done. Home cards light, Away dark (light shades per the 0.8 table).
- Today each half has about 6 px of vertical slack with 10 players (0.8 measurement); the Sub button
  and ghosted bench rows must fit 10 players plus controls without scrolling.
- Every play names its team in toasts and the Log.
- The quarter's status, the CSVs and every count are unaffected by the lineup.

## Calls left to the builder

- Exact layout of the + Play / Sub row and how the 6 px budget is kept (shorter bench rows, a 40 px
  shared row, or both), measured on the iPhone 13 profile with 10 + 10 players.
- The anchoring of a sub among plays (it must survive Log edits that reorder plays) and the replay's
  tie-break when a sub and a play share a position.
- The ghosted bench style per tone, within the color table; verify the solid/ghost difference is
  visible on the light Home cards (a screenshot in the first review).
- The demo roster contents (invented names, both teams, more than five each so the bench shows).
- Tests: a pure `lineup(game, side)` with unit tests for every rule above (including Log corrections
  around a sub); e2e for the deliberate sub, a line change, the forgotten-sub flow with "likely", a
  foul-out, Starters, and demo mode not touching real storage; the UX audit's scripted game gains sub
  events (a routine sub, a line change at a break, a forgotten sub, a foul-out).
- The How-to and changelog for all of the above.
