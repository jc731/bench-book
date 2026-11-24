# Colors

The color rules for the Bench Book interface. `CLAUDE.md` points here: follow this table, and
update it with any change to the interface.

Each color has one job, so a color on screen says what kind of thing it is. Keep to these
when adding to the interface:

| Color | Means | Examples |
|---|---|---|
| **Amber** | Caution: something to look at, never "tap here" | a player at 4 fouls, the bonus, team fouls near the bonus, bench techs, a check that doesn't match (and the Book cell sheet's "check now 2 over" line), a file not saved yet, Not saving, the timeout clock's last half |
| **Red** | Out, or ends something for good | an out player (and the Book cell sheet's out line), End Q4 / OT (can end the game), Discard when the game is not exported, the timeout clock's Time |
| **Blue** (`sky`) | The action to take, links, selection, focus | End Q1–Q3, Check, Undo, Redo, Home/Away chosen (Setup, Book), the Book tab chosen, focused fields |
| **White fill** | The main button of a screen or sheet | Start game, Save, Done, Book CSV, Plays CSV |
| **Green** | Done and fine | Matched, Fixed, saved files |
| **Gray** (`slate`) | Everything else: data, ordinary buttons, neutral state | the cards (one style, outlines slate-600 on Home and slate-400 on Away; the cards after the top five are one fill step closer to the half's background: grayer on Home (slate-100 on white), darker on Away), the Sub button, the sub sheet's "just in" tag and "longest without a play" hint, the Demo strip, the small Home/Away tag over a team name in a half header, a player's first three fouls, the bar |

Home cards are light (white) and Away cards dark, so the state colors have two sets of shades,
each kept at 3:1 or better for borders and dots and 4.5:1 for text:

| Card | Warn border and dots (4 fouls; Bench card with techs) | Out | Warn text (team fouls near the bonus, tech count) |
|---|---|---|---|
| Dark (Away) | amber-400 | red-500 border and dots, red-400 OUT | amber-300 |
| Light (Home) | amber-600 (amber-700 on the cards after the top five and on the Bench card: amber-600 measured 2.92:1 on slate-100) | red-600 border, dots and OUT | amber-800 |

A warned card's number, name and points keep the card's ordinary text color (slate-900 on a
light card, white on a dark one); only its border and dots turn amber.

A status shown on a button (the amber check chip for a quarter that doesn't match) is still a
state color: the color says what is true, and the button shape says it can be tapped.
