---
name: ux-audit
description: Runs Bench Book's first-timer UX audit. A blind persona agent plays a scripted game in a phone-sized browser, the run is checked for cheating, the exported files are compared with the expected end state, and the result is written to docs/ux-audit/reports/v<version>.md. Use when asked to run the UX audit or /ux-audit.
---

# First-timer UX audit

You are the **controller**. You build and serve the app, dispatch the blind `ux-persona`
agent, check its transcript, compare the exported files with the expected end state, and
write the report. The persona is the only one who plays; you never coach it.

Binding rules (spec: `docs/superpowers/specs/2026-11-10-testing-and-ux-audit-design.md`,
Part 2):

- The persona gets **only** the persona file, the `## Events` section and the app URL. Never
  the `## Expected end state`, never a repo path, never a button name or a hint.
- **Never edit app code.** The audit writes a report and its screenshots, nothing else.
- No push and no deploy.
- Run this in a **fresh Claude Code session started inside the repo**
  (`cd ~/Dev/bench-book && claude`): the project's `.mcp.json` and `.claude/agents/` load
  from the session's start directory, and the `ux-browser` server starts with an isolated,
  empty browser profile once per session, so an earlier run in the same session would leave
  a saved game behind. Do not use the `ux-browser` tools yourself before step 3.
- If the `mcp__ux-browser__*` tools are not available, first check the session's working
  directory (it must be the repo root; if not, tell the owner to restart from there). Only
  then ask the owner to approve the project's `ux-browser` MCP server (`.mcp.json`).

All paths below are relative to the repo root.

## 1. Pick the report path

```bash
node -p "require('./package.json').version"
ls docs/ux-audit/reports/ 2>/dev/null
```

The report is `docs/ux-audit/reports/v<version>.md`. If that file exists, use
`v<version>-2.md`, then `-3`, and so on. Call the chosen name (without `.md`) `<run>`; its
screenshots go in `docs/ux-audit/reports/<run>/`.

A **void** run (step 4) does not take that slot. Its report is
`docs/ux-audit/reports/v<version>-void.md`, or `v<version>-void-2.md`, `-void-3`… if that
exists; `<run>` is then that name.

## 2. Build and serve

```bash
pnpm build
```

Then start the preview **in the background** (Bash with `run_in_background`):

```bash
pnpm exec astro preview --port 4410 --ignore-lock
```

Wait until `curl -sf http://localhost:4410/ >/dev/null` succeeds. If port 4410 is already in
use, stop and tell the owner rather than picking another port. The app URL is
`http://localhost:4410/`.

## 3. Dispatch the persona

Build the prompt in the scratchpad (not in the repo) with exactly this command, so the
prompt is reproducible and checkable:

```bash
P="<scratchpad>/ux-persona-prompt.md"
{
  cat docs/ux-audit/personas/bookkeeper.md
  printf '\n---\n\n# The game\n\n'
  awk '/^## Events$/{f=1; next} /^## /{f=0} f' docs/ux-audit/scenario.md
  printf '\n---\n\nThe app is at: http://localhost:4410/\n'
} > "$P"
grep -c 'Expected end state' "$P"   # must print 0
```

Dispatch the Agent tool with `subagent_type: ux-persona` and the file's contents, verbatim,
as the prompt. Add nothing: no tips, no names of controls, no paths.

When it returns, keep its narration and find its transcript. The Agent result gives the
agent id (or its output path). The transcript is
`~/.claude/projects/<project-dir>/<session-id>/subagents/agent-<id>.jsonl`; the project dir
depends on where the session started, so find it with:

```bash
ls ~/.claude/projects/*/*/subagents/agent-<id>.jsonl
```

## 4. Check the transcript

```bash
pnpm ux:stats <transcript.jsonl> http://localhost:4410/ --prompt <built prompt file>
```

- **Any non-zero exit: the run is void.** Exit 2 means a disallowed tool was used, the
  persona navigated off the app, the persona's received prompt differs from the built
  prompt file, or the transcript is empty or unreadable; exit 1 means
  the check itself crashed (for example on a malformed tool call), which voids the run too.
  Never treat a non-zero exit as a pass. Write a short report at the chosen path saying
  the run was void and why (the `reasons`, or the error output), at the void path from
  step 1 (`v<version>-void.md`, not the version's report slot). Then do step 7, commit
  that report as in step 8 with the message `docs: UX audit <run>`, and stop. Do not
  write findings from a void run.
- **Exit 0:** keep the JSON. `perEvent[N].actions` is the number of actions the persona
  spent on event N; `totalActions` is the whole run.

## 5. Compare the result with the expected end state

Now, as the controller, use the `ux-browser` tools on **the same browser session** (the
persona's game is in that browser's storage). Do not navigate away from the app URL.

1. Go to the app's end-of-game and export screen. If the persona's game is there but was
   never ended, end it yourself without changing any entry, and note that in the report.

   **If the persona's game is not in the browser** (the app shows a new, empty game, or
   the browser was closed): do **not** recreate a game, and do not start or end one.
   Record "export comparison not possible" in the report with the reason. As the fallback
   source, use any files the persona itself downloaded (under `.playwright-mcp/`, or at
   the path its tool results reported) and compare those in item 3. If there are none,
   the report has no export comparison, and says so in the summary.
2. Download both CSV files. The tool result says where each was saved (under
   `.playwright-mcp/`). Read them.
3. Compare them with `## Expected end state` in `docs/ux-audit/scenario.md`: the score per
   quarter, each player's points and fouls (and the other columns given), team fouls,
   timeouts used and the check results. **Each difference is a `wrong entry` finding**,
   whether or not the persona noticed it. How to compare: Q2's check may read matched or
   fixed; unchecked quarters, or a missing opponent score, are `hesitated`/`blocked`
   findings, not wrong entries; only an entry that disagrees with an event counts as a
   wrong entry.

Copy the screenshots that findings will cite into `docs/ux-audit/reports/<run>/`, and only
those. Look at each one: they may show only the scenario's invented names.

## 6. Write the report

Write `docs/ux-audit/reports/<run>.md`, in US English:

```markdown
# UX audit <run>

## Summary
- Version, date, persona (bookkeeper), app URL.
- Events: N done, N hesitated, N failed, N skipped (from the persona's outcomes, adjusted
  as below). Wrong entries found by the export comparison: N.
- Top 3 problems, one line each.

## Events
| # | Event (short) | Persona outcome | Actions | Notes |
(one row per event; Actions = perEvent[N].actions from ux:stats, "–" if none)

## Findings
### F1. <short title>
- Screen:
- Event:
- Expected:
- Did:
- Happened:
- Severity: blocked | wrong entry | hesitated | polish
- Suggested direction: (a suggestion; the owner decides the wording)
- Screenshot: <run>/<file>.png (if it helps)

## Compared with v<prev>
(only when an earlier report exists)
- Gone: …
- Still here: …
- New: …
```

Rules for the content:

- Put the **per-event action counts beside the persona's outcomes**. Many actions on an
  event the persona marked `done` is a hesitation even if it didn't say so; record it as
  `hesitated` and say why. Compare against the run's typical count for a similar event.
- Severity: **blocked** (couldn't do it), **wrong entry** (did the wrong thing without
  noticing, including every export difference), **hesitated** (got there, unsure),
  **polish**.
- Frame the findings as **leads from a single run**, not a scorecard. Say so in the summary.
- For "Compared with", read the most recent earlier report in `docs/ux-audit/reports/`
  only now, after the run. Match findings by what went wrong, not by number.

## 7. Clean up

- Stop the background preview server, and confirm port 4410 is free
  (`curl -sf http://localhost:4410/` fails).
- Delete the MCP server's output dir after copying the screenshots you need:
  `rm -rf .playwright-mcp`.
- Delete the scratchpad prompt file.

## 8. Commit

Never edit app code. Stage only the report and its screenshot dir, and commit:

```bash
git add docs/ux-audit/reports/<run>.md
[ -d docs/ux-audit/reports/<run> ] && git add docs/ux-audit/reports/<run>/   # void runs have no screenshots
git commit -m "docs: UX audit <run>"
```

(For a first run on 0.1.0 the message is `docs: UX audit v0.1.0`.) The commit carries no
attribution trailer. Do not push.
