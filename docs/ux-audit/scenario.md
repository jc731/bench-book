# First-timer audit scenario

The controller gives the persona only the `## Events` section. The `## Expected end state`
section is for the controller alone, to compare against the exported files after the run.
Every name here is invented.

## Events

1. You're at the scorer's table before tip-off, and this is the app you'll keep the game
   in, beside your paper book. Tonight is a home game: your team, Test Home, plays Test
   Opp. You keep the book for both teams, and you'd like the app to follow both. Your
   coach hands you your list:

   | Pos | Name | No. |
   |---|---|---|
   | G | Avery Quill | 3 |
   | G | Gray Holloway | 5 |
   | G | Bo Tannery | 7 |
   | F | Casey Wren | 10 |
   | F | Dana Morrow | 12 |
   | C | Emery Stokes | 22 |
   | F | Finley Ashby | 33 |

   The other coach's list has every number but only some names:

   | No. | Name |
   |---|---|
   | 2 | Jordan Pike |
   | 11 | |
   | 14 | Riley Vance |
   | 21 | Sam Ortiz |
   | 24 | |

   Get ready for the tip.
2. Tip-off, first quarter. #3 makes a two.
3. Their #14 makes a two.
4. #10 makes a three.
5. The ref calls a foul on #22.
6. Their #2 goes to the line for two and makes one of them.
7. #12 makes a two.
8. The ref calls a foul on their #21.
9. #5 is fouled shooting and goes to the line for two: makes the first, misses the
   second.
10. Their #24 makes a three.
11. #3 makes a two.
12. The horn sounds, end of the first quarter. Your book shows 10 for you and 6 for them
    this quarter.
13. Second quarter. #22 makes a two.
14. The ref calls a foul on their #21, her second.
15. #12 scores a layup. Someone at the table is asking you a question while it happens.
16. Their #11 makes a two.
17. Their coach calls a timeout, a full one.
18. #3 makes a two. Your thumb slips and the app gets it as #33's basket. You notice right
    away: you just credited the wrong player. Make it right.
19. The ref calls a foul on #7.
20. #12 is fouled and goes to the line for two: makes the first, misses the second.
21. The ref calls a foul on their #21, her third.
22. #10 makes a two.
23. Their #14 makes a three.
24. Your coach leans over: the two-pointer you gave #10 earlier this quarter (her only
    basket of the second quarter) was actually #7's.
25. The ref signals a timeout for your coach, a full one.
26. The ref calls a foul on #22, her second.
27. Their #2 makes a two.
28. The horn sounds, end of the half. Your book shows 10 for you and 7 for them this
    quarter, 20 to 13 at the half.
29. Looking back over your book, you find the difference: it has #12's second free throw
    this quarter as made. It went in after all; you had it as a miss.
30. Your book also shows a foul on #33 this quarter that never made it into the app. It
    belongs in the second quarter.
31. Third quarter. A player for Test Opp who isn't on the list their coach gave you checks
    in at the table: #45. She makes a three.
32. #33 makes a three.
33. The ref calls a foul on their #21. The scorer's table says that's her fourth.
34. #10 makes a two.
35. The ref calls a foul on their #21 again, her fifth. She's out of the game.
36. #5 goes to the line for two and makes both.
37. Their #45 makes a two.
38. The horn sounds, end of the third quarter. Your book shows 7 for you and 5 for them
    this quarter, 27 to 18 overall.
39. Fourth quarter. #7 makes a two.
40. Their #14 makes a three.
41. Their coach calls a timeout, a thirty-second one.
42. The ref calls a foul on #3.
43. Their #24 goes to the line for two and misses both.
44. The ref signals a timeout for your coach, a thirty-second one.
45. #33 is fouled shooting and goes to the line for two. She makes both.
46. Their #45 makes a two.
47. The horn sounds, end of the fourth quarter, and the game is over: no overtime. Your
    book shows 4 for you and 5 for them this quarter, 31 to 23 final.
48. After the handshake line, your coach asks you for the two files from this game, the
    ones she always wants afterward. Get them saved.

## Expected end state

Worked out by hand from the events above, after the persona's corrections (event 18's
basket on #3, event 24's basket on #7, event 29's free throw made, and event 30's foul on
#33 in Q2). Test Home is the home team; Test Opp is away.

**How to compare.** Q2's check may read matched or fixed. Unchecked quarters, or a missing
opponent score on a check, are hesitated/blocked findings, not wrong entries. Only an entry
that disagrees with an event counts as a wrong entry, including a play on the wrong team.
Their #45 may have no name. If #45's plays were recorded for Test Opp with no number, their
score is right but #45's line is missing: a wrong entry for each of her three baskets. If
event 30's foul landed in Q3 rather than Q2, that is a wrong entry.

**Score per quarter**

| | Q1 | Q2 | Q3 | Q4 | Total |
|---|---|---|---|---|---|
| Test Home | 10 | 10 | 7 | 4 | 31 |
| Test Opp | 6 | 7 | 5 | 5 | 23 |

Running score after each quarter: Test Home 10, 20, 27, 31; Test Opp 6, 13, 18, 23.

- Test Home Q1: #3 2 + #10 3 + #12 2 + #5 1 + #3 2 = 10.
- Test Home Q2: #22 2 + #12 2 + #3 2 + #12 2 (free throws, both made) + #7 2 = 10. Before
  event 29 the app holds 9 (20 after the half against 19), one short of the book.
- Test Home Q3: #33 3 + #10 2 + #5 2 = 7.
- Test Home Q4: #7 2 + #33 2 = 4.
- Test Opp Q1: #14 2 + #2 1 + #24 3 = 6.
- Test Opp Q2: #11 2 + #14 3 + #2 2 = 7.
- Test Opp Q3: #45 3 + #45 2 = 5.
- Test Opp Q4: #14 3 + #24 0 + #45 2 = 5.

**Test Home players**

| No. | Name | Points | Fouls | Techs | 2s | 3s | FT made / att. | Out |
|---|---|---|---|---|---|---|---|---|
| 3 | Avery Quill | 6 | 1 | 0 | 3 | 0 | 0 / 0 | |
| 5 | Gray Holloway | 3 | 0 | 0 | 0 | 0 | 3 / 4 | |
| 7 | Bo Tannery | 4 | 1 | 0 | 2 | 0 | 0 / 0 | |
| 10 | Casey Wren | 5 | 0 | 0 | 1 | 1 | 0 / 0 | |
| 12 | Dana Morrow | 6 | 0 | 0 | 2 | 0 | 2 / 2 | |
| 22 | Emery Stokes | 2 | 2 | 0 | 1 | 0 | 0 / 0 | |
| 33 | Finley Ashby | 5 | 1 | 0 | 0 | 1 | 2 / 2 | |
| | **Team** | **31** | **5** | **0** | **9** | **2** | **7 / 8** | |

Points check: 6 + 3 + 4 + 5 + 6 + 2 + 5 = 31, and 9 twos (18) + 2 threes (6) + 7 free
throws = 31.

**Test Opp players**

| No. | Name | Points | Fouls | Techs | 2s | 3s | FT made / att. | Out |
|---|---|---|---|---|---|---|---|---|
| 2 | Jordan Pike | 3 | 0 | 0 | 1 | 0 | 1 / 2 | |
| 11 | | 2 | 0 | 0 | 1 | 0 | 0 / 0 | |
| 14 | Riley Vance | 8 | 0 | 0 | 1 | 2 | 0 / 0 | |
| 21 | Sam Ortiz | 0 | 5 | 0 | 0 | 0 | 0 / 0 | out on 5 fouls (Q3) |
| 24 | | 3 | 0 | 0 | 0 | 1 | 0 / 2 | |
| 45 | (added in Q3) | 7 | 0 | 0 | 2 | 1 | 0 / 0 | |
| | **Team** | **23** | **5** | **0** | **5** | **4** | **1 / 4** | |

Points check: 3 + 2 + 8 + 0 + 3 + 7 = 23, and 5 twos (10) + 4 threes (12) + 1 free throw
= 23.

**Points by quarter per player**

| Team | No. | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|---|
| Home | 3 | 4 (2, 2) | 2 | | |
| Home | 5 | 1 (FT made, FT missed) | | 2 (FT made, FT made) | |
| Home | 7 | | 2 | | 2 |
| Home | 10 | 3 | | 2 | |
| Home | 12 | 2 | 4 (2, FT made, FT made) | | |
| Home | 22 | | 2 | | |
| Home | 33 | | | 3 | 2 (FT made, FT made) |
| Away | 2 | 1 (FT made, FT missed) | 2 | | |
| Away | 11 | | 2 | | |
| Away | 14 | 2 | 3 | | 3 |
| Away | 24 | 3 | | | 0 (FT missed, FT missed) |
| Away | 45 | | | 5 (3, 2) | 2 |

**Team fouls per quarter**

| | Q1 | Q2 | Q3 | Q4 | Total |
|---|---|---|---|---|---|
| Test Home | 1 (#22) | 3 (#7, #22, #33 added at halftime) | 0 | 1 (#3) | 5 |
| Test Opp | 1 (#21) | 2 (#21, #21) | 2 (#21, #21) | 0 | 5 |

Each total equals that team's players' fouls. Neither team reaches the bonus in any quarter.
No bench technicals for either team.

**Timeouts used**

| | Full | Thirty-second |
|---|---|---|
| Test Home | 1 of 3 (event 25) | 1 of 2 (event 44) |
| Test Opp | 1 of 3 (event 17) | 1 of 2 (event 41) |

**Checks against the book** (our game score / their game score after the quarter):

- Q1 matches (10 / 6).
- Q2: the book has 20 / 13, the app 19 / 13. Our score is 1 short until event 29's free
  throw is changed to made, then matches. Their score agrees throughout, so it never warns.
  The team fouls read Home 2, Away 2 until event 30's foul is added, then Home 3; adding it
  does not move the score.
- Q3 matches (27 / 18).
- Q4 matches (31 / 23).

The game is ended after Q4 with no overtime.
