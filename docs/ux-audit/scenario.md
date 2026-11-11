# First-timer audit scenario

The controller gives the persona only the `## Events` section. The `## Expected end state`
section is for the controller alone, to compare against the exported files after the run.
Every name here is invented.

## Events

1. You're at the scorer's table before tip-off, and this is the app you'll keep the game
   in, beside your paper book. Tonight is a home game: your team, Test Home, plays Test
   Opp. Your coach hands you the list:

   | Pos | Name | No. |
   |---|---|---|
   | G | Avery Quill | 3 |
   | G | Gray Holloway | 5 |
   | G | Bo Tannery | 7 |
   | F | Casey Wren | 10 |
   | F | Dana Morrow | 12 |
   | C | Emery Stokes | 22 |
   | F | Finley Ashby | 33 |

   You'd like to keep their score too, if the app lets you. Get ready for the tip.
2. Tip-off, first quarter. #3 makes a two.
3. They score a two.
4. #10 makes a three.
5. The ref calls a foul on #22.
6. Their shooter goes to the line for two and makes one of them.
7. #12 makes a two.
8. The ref calls a foul on #7.
9. #5 is fouled shooting and goes to the line for two: makes the first, misses the
   second.
10. They make a three.
11. #3 makes a two.
12. The horn sounds, end of the first quarter. Your book shows 10 for you and 6 for them
    this quarter.
13. Second quarter. #22 makes a two.
14. The ref calls a foul on #22, her second.
15. #12 scores a layup. Someone at the table is asking you a question while it happens.
16. They score a two.
17. The ref signals a timeout for your coach, a full one.
18. #3 makes a two. Your thumb slips and the app gets it as #33's basket. You notice right
    away: you just credited the wrong player. Make it right.
19. The ref calls a foul on #7, her second.
20. The ref calls a foul on #33.
21. #10 makes a two.
22. They score a two.
23. The ref calls a foul on #5.
24. Your coach leans over: the basket you gave #10 a couple of plays ago was actually #7's.
25. The ref calls a foul on #22, her third. That's your team's fifth foul this quarter.
26. Their shooter goes to the line for two and makes both.
27. The horn sounds, end of the half. Your book shows 9 for you and 6 for them this
    quarter, 19 to 12 at the half.
28. Looking back over your book, you find the difference: you missed recording a free
    throw by #12 earlier this quarter. She was fouled on that layup and made the free
    throw. It belongs in the second quarter.
29. Third quarter. #33 makes a three.
30. The ref calls a foul on #22. The scorer's table says that's her fourth.
31. They score a two.
32. #10 makes a two.
33. The ref calls a foul on #22 again, her fifth. She's out of the game.
34. Their shooter goes to the line for two and makes one of them.
35. #5 makes a three.
36. The horn sounds, end of the third quarter. Your book shows 8 for you and 3 for them
    this quarter, 27 to 15 overall.
37. Fourth quarter. #7 makes a two.
38. They make a three.
39. The ref signals a timeout for your coach, a thirty-second one.
40. The ref calls a foul on #3.
41. #33 is fouled shooting and goes to the line for two. She makes both.
42. They score a two.
43. The horn sounds, end of the fourth quarter, and the game is over: no overtime. Your
    book shows 4 for you and 5 for them this quarter, 31 to 20 final.
44. After the handshake line, your coach asks you for the two files from this game, the
    ones she always wants afterward. Get them saved.

## Expected end state

Worked out by hand from the events above, after the persona's corrections (event 18's
basket on #3, event 24's basket on #7, and the event 28 free throw on #12 in Q2).

**Score per quarter**

| | Q1 | Q2 | Q3 | Q4 | Total |
|---|---|---|---|---|---|
| Test Home | 10 | 9 | 8 | 4 | 31 |
| Test Opp | 6 | 6 | 3 | 5 | 20 |

- Test Home Q1: #3 2 + #10 3 + #12 2 + #5 1 + #3 2 = 10.
- Test Home Q2: #22 2 + #12 2 + #3 2 + #7 2 + #12 1 (free throw) = 9. Before event 28
  the app holds 8, one short of the book.
- Test Home Q3: #33 3 + #10 2 + #5 3 = 8.
- Test Home Q4: #7 2 + #33 2 = 4.
- Test Opp: Q1 2 + 1 + 3 = 6; Q2 2 + 2 + 2 = 6; Q3 2 + 1 = 3; Q4 3 + 2 = 5.

**Players**

| No. | Name | Points | Fouls | Techs | 2s | 3s | FT made / att. | Out |
|---|---|---|---|---|---|---|---|---|
| 3 | Avery Quill | 6 | 1 | 0 | 3 | 0 | 0 / 0 | |
| 5 | Gray Holloway | 4 | 1 | 0 | 0 | 1 | 1 / 2 | |
| 7 | Bo Tannery | 4 | 2 | 0 | 2 | 0 | 0 / 0 | |
| 10 | Casey Wren | 5 | 0 | 0 | 1 | 1 | 0 / 0 | |
| 12 | Dana Morrow | 5 | 0 | 0 | 2 | 0 | 1 / 1 | |
| 22 | Emery Stokes | 2 | 5 | 0 | 1 | 0 | 0 / 0 | out on 5 fouls (Q3) |
| 33 | Finley Ashby | 5 | 1 | 0 | 0 | 1 | 2 / 2 | |
| | **Team** | **31** | **10** | **0** | **9** | **3** | **4 / 5** | |

Points check: 6 + 4 + 4 + 5 + 5 + 2 + 5 = 31, and 9 twos (18) + 3 threes (9) + 4 free
throws = 31.

**Points by quarter per player**

| No. | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|
| 3 | 4 (2, 2) | 2 | | |
| 5 | 1 (FT made, FT missed) | | 3 | |
| 7 | | 2 | | 2 |
| 10 | 3 | | 2 | |
| 12 | 2 | 3 (2, FT made) | | |
| 22 | | 2 | | |
| 33 | | | 3 | 2 (FT made, FT made) |

**Team fouls per quarter:** Q1 2 (#22, #7); Q2 5 (#22, #7, #33, #5, #22: the opponent is in
the bonus from event 25); Q3 2 (#22, #22); Q4 1 (#3). Total 10, equal to the players'
fouls. No bench technicals.

**Timeouts used:** full 1 of 3 (event 17); thirty-second 1 of 2 (event 39).

**Checks against the book:** Q1 matches (10 / 6). Q2 differs by 1 until event 28's free
throw is added, then matches (9 / 6). Q3 matches (8 / 3). Q4 matches (4 / 5). The game is
ended after Q4 with no overtime.
