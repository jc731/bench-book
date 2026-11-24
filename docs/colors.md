# Colors

The color rules for the Bench Book interface. `CLAUDE.md` points here: follow this table, and
update it with any change to the interface.

Each color has one job, so a color on screen says what kind of thing it is. Keep to these
when adding to the interface:

| Color | Means | Examples |
|---|---|---|
| **Amber** | Caution: something to look at, never "tap here" | a player at 4 fouls, the bonus, team fouls near the bonus, bench techs, a check that doesn't match (and the Book cell sheet's "check now 2 over" line), a file not saved yet, Not saving, the timeout clock's last half |
| **Red** | Out, or ends something for good | an out player (and the Book cell sheet's out line), End Q4 / OT (can end the game), Discard when the game is not exported, the timeout clock's Time |
| **Blue** (`sky`) | The action to take, links, selection, focus | End Q1–Q3, Check, Undo, Redo, Home/Away chosen (Setup, Book), the Book tab chosen, focused fields, a row just recorded or moved (sky-100 fill on Home, sky-900 on Away, for 400 ms after a row tap and 1 s after a swap; the fill only, never the ring) |
| **White fill** | The main button of a screen or sheet | Start game, Save, Done, Book CSV, Plays CSV |
| **Green** | Done and fine | Matched, Fixed, saved files |
| **Gray** (`slate`) | Everything else: data, ordinary buttons, neutral state | the player rows (one style; each row's +2 is filled, slate-200 with a slate-500 border on Home and slate-600 with a slate-400 border on Away, and its Foul is the word outlined, same border, transparent fill; the rows after the top five are one fill step closer to the half's background: grayer on Home (slate-100 on white), darker on Away; a player's points are small gray text, slate-600 on Home and slate-300 on Away), the Sub button, the sub sheet's "just in" tag and "longest without a play" hint, the Demo strip, the small Home/Away tag over a team name in a half header, a player's first three fouls, the bar |

Home rows are light (white) and Away rows dark, so the state colors have two sets of shades,
each kept at 3:1 or better for borders, rings and dots and 4.5:1 for text. A row's state is an
inset 2 px ring (4 fouls amber, out red) and its dots. While a row flashes (the blue job above)
the ring takes a flash shade so it keeps 3:1 on the flash fill:

| Row | Warn ring and dots (4 fouls; Tech button with techs) | Out | Warn text (team fouls near the bonus, tech count) |
|---|---|---|---|
| Dark (Away) | amber-400 | red-500 ring and dots, red-400 OUT; red-400 ring while flashing | amber-300 |
| Light (Home) | amber-600 (amber-700 on the rows after the top five, on the Tech button and while flashing: amber-600 measured 2.92:1 on slate-100 and 2.78:1 on sky-100) | red-600 ring, dots and OUT | amber-800 |

A warned row's number and points keep the row's ordinary text colors; only its ring and dots turn
amber. An out row's number and points are grayed, and its +2 and Foul have dashed borders: they
open the player's sheet and record nothing.

A status shown on a button (the amber check chip for a quarter that doesn't match) is still a
state color: the color says what is true, and the button shape says it can be tapped.

## Contrast of the 1.1 rows

Measured 2026-11-24 with the WCAG 2.x formula from Tailwind 4's oklch values (one-off script,
not kept; no automated contrast test, by the 1.1 design). Targets: 3:1 for borders, rings and
dots, 4.5:1 for text. Row fills: Home card white, rest slate-100, flash sky-100; Away card
slate-800, rest #172033, flash sky-900.

| Pair | Home (light) | Away (dark) |
|---|---|---|
| +2 and Foul border on card / rest / flash | slate-500: 4.77 / 4.35 / 4.15 | slate-400: 5.58 / 6.19 / 3.60 |
| +2 border on its own fill | slate-500 on slate-200: 3.87 | slate-400 on slate-600: 2.88 |
| +2 fill against card / rest / flash | slate-200: 1.23 / 1.12 / 1.07 | slate-600: 1.94 / 2.15 / 1.25 |
| Amber ring on card / rest / flash | amber-600 3.19 / amber-700 4.61 / amber-700 4.40 | amber-400: 8.54 / 9.47 / 5.51 |
| Red ring on card / rest / flash | red-600: 4.76 / 4.35 / 4.15 | red-500 3.84 / 4.26, red-400 on flash 3.27 (red-500 on flash would be 2.48) |
| Points on card / rest / flash | slate-600: 7.56 / 6.90 / 6.58 | slate-300: 9.87 / 10.96 / 6.38 |

Two rows of that table read under 3:1 and neither is a failure. The Away +2 border on its own
fill (2.88) is not the button's boundary: the boundary against the row is the border, 3.60 to
6.19 on Away and 4.15 to 4.77 on Home, which clears 3:1 on every row fill, so the shade stays.
The fills alone (1.07 to 2.15) are shape, never the boundary. The lowest pass is red-400 on the
Away flash fill at 3.27, which is why the flashing out ring is red-400 and not red-500.
