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

   Your starters are the first five on your list: #3, #5, #7, #10 and #12. Get ready for
   the tip.
2. Tip-off, first quarter. #3 makes a two.
3. Their #14 makes a two.
4. #10 makes a three.
5. #22 checks in at the table for #7.
6. The ref calls a foul on #22.
7. Their #2 goes to the line for two and makes one of them.
8. #12 makes a two.
9. The ref calls a foul on their #21.
10. #5 is fouled shooting and goes to the line for two: makes the first, misses the
    second.
11. Their #24 makes a three.
12. #3 makes a two.
13. The horn sounds, end of the first quarter. Your book shows 10 for you and 6 for them
    this quarter.
14. Second quarter. #22 makes a two.
15. The ref calls a foul on their #21, the second for #21.
16. #12 scores a layup. Someone at the table is asking you a question while it happens.
17. Their #11 makes a two.
18. Their coach calls a timeout, a full one.
19. During the timeout, #7 checks in at the table for #5.
20. #3 makes a two. Your thumb slips and the app gets it as #33's basket. You notice right
    away: you just credited the wrong player. Make it right.
21. The ref calls a foul on #7.
22. #12 is fouled and goes to the line for two: makes the first, misses the second.
23. The ref calls a foul on their #21, the third for #21.
24. #10 makes a two.
25. Their #14 makes a three.
26. Your coach leans over: the two-pointer you gave #10 earlier this quarter (#10's only
    basket of the second quarter) was actually #7's.
27. The ref signals a timeout for your coach, a full one.
28. The ref calls a foul on #22, the second for #22.
29. Their #2 makes a two.
30. The horn sounds, end of the half. Your book shows 10 for you and 7 for them this
    quarter, 20 to 13 at the half.
31. Looking back over your book, you find the difference: it has #12's second free throw
    this quarter as made. It went in after all; you had it as a miss.
32. Your book also shows a foul on #33 this quarter that never made it into the app. It
    belongs in the second quarter.
33. That foul means #33 was in the game in the second quarter, but you never saw #33
    check in at the table. Your coach remembers: #33 went in for #10.
34. Third quarter. Your coach changes the group to start the half: #5 and #10 check in at
    the table for #12 and #22.
35. A player for Test Opp who isn't on the list their coach gave you checks in at the
    table for their #24: #45. #45 makes a three.
36. #33 makes a three.
37. The ref calls a foul on their #21. The scorer's table says that's the fourth for #21.
38. #10 makes a two.
39. The ref calls a foul on their #21 again, the fifth for #21. #21 is out of the game.
40. Their #24 checks back in at the table, for #21.
41. #5 goes to the line for two and makes both.
42. Their #45 makes a two.
43. The horn sounds, end of the third quarter. Your book shows 7 for you and 5 for them
    this quarter, 27 to 18 overall.
44. Fourth quarter. #7 makes a two.
45. Their #14 makes a three.
46. Their coach calls a timeout, a thirty-second one.
47. The ref calls a foul on #3.
48. Their #24 goes to the line for two and misses both.
49. The ref signals a timeout for your coach, a thirty-second one.
50. #33 is fouled shooting and goes to the line for two and makes both.
51. Their #45 makes a two.
52. The horn sounds, end of the fourth quarter, and the game is over: no overtime. Your
    book shows 4 for you and 5 for them this quarter, 31 to 23 final.
53. After the handshake line, your coach asks you for the two files from this game, the
    ones the coach always wants afterward. Get them saved.

## Expected end state

Worked out by hand from the events above, after the persona's corrections (event 20's
basket on #3, event 26's basket on #7, event 31's free throw made, and event 32's foul on
#33 in Q2). Test Home is the home team; Test Opp is away.

**How to compare.** Q2's check may read matched or fixed. Unchecked quarters, or a missing
opponent score on a check, are hesitated/blocked findings, not wrong entries. Only an entry
that disagrees with an event counts as a wrong entry, including a play on the wrong team.
Their #45 may have no name. If #45's plays were recorded for Test Opp with no number, their
score is right but #45's line is missing: a wrong entry for each of #45's three baskets. If
event 32's foul landed in Q3 rather than Q2, that is a wrong entry.

**Expected lineup** (for the controller; the lineup changes no score or count and is in neither
exported file, so read it from the live screen at the end). It never makes an entry wrong: a
missed or different sub is a lineup finding (hesitated, skipped or a wrong sub), not a wrong
entry.

- Test Home starts #3, #5, #7, #10, #12 (bench #22, #33): the first five on the list, as entered.
  Event 5: #22 in for #7 (a routine sub). Event 19: #7 in for #5 (a routine sub, during the
  timeout). Event 32's foul, added to Q2 at the check, puts #33 on the floor by itself (six on);
  event 33 says who #33 replaced: #10 (the app marks #10 "likely", since the only basket #10 had that
  quarter became #7's at event 26). Event 34: #5 and #10 in for #12 and #22 (a line change at
  the half).
- Test Opp has no bench until #45 joins (event 35, on the floor by #45's own basket, six on):
  #24 out. Event 39 fouls #21 out (four on); event 40: #24 back in.
- On the floor at the end: **Test Home #3, #5, #7, #10, #33** (bench #12, #22). **Test Opp #2,
  #11, #14, #24, #45** (#21 out).
- Entered as the events read, every player is already on the floor when they play: #22 at
  event 6, #7 at event 21, #10 at event 24 (before the fix), #5 at event 41. If the persona
  skipped a sub, that player goes on by themselves when they play: six on, which blocks nothing.

**Score per quarter**

| | Q1 | Q2 | Q3 | Q4 | Total |
|---|---|---|---|---|---|
| Test Home | 10 | 10 | 7 | 4 | 31 |
| Test Opp | 6 | 7 | 5 | 5 | 23 |

Running score after each quarter: Test Home 10, 20, 27, 31; Test Opp 6, 13, 18, 23.

- Test Home Q1: #3 2 + #10 3 + #12 2 + #5 1 + #3 2 = 10.
- Test Home Q2: #22 2 + #12 2 + #3 2 + #12 2 (free throws, both made) + #7 2 = 10. Before
  event 31 the app holds 9 (20 after the half against 19), one short of the book.
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
| Test Home | 1 of 3 (event 27) | 1 of 2 (event 49) |
| Test Opp | 1 of 3 (event 18) | 1 of 2 (event 46) |

**Checks against the book** (our game score / their game score after the quarter):

- Q1 matches (10 / 6).
- Q2: the book has 20 / 13, the app 19 / 13. Our score is 1 short until event 31's free
  throw is changed to made, then matches. Their score agrees throughout, so it never warns.
  The team fouls read Home 2, Away 2 until event 32's foul is added, then Home 3; adding it
  does not move the score.
- Q3 matches (27 / 18).
- Q4 matches (31 / 23).

The game is ended after Q4 with no overtime.
