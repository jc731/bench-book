import { MARK_LEGEND } from './running-logic';

export interface HowtoSection {
  id: string;
  title: string;
  body: string[];
  image?: { src: string; alt: string };
}

export const HOWTO_SECTIONS: HowtoSection[] = [
  {
    id: 'what',
    title: 'What this is',
    body: ['Bench Book sits beside the paper scorebook, which stays the official record.', 'It keeps score and fouls so you can check the book against it.'],
  },
  {
    id: 'tip-off',
    title: 'Before tip-off',
    body: [
      'Pick Home or Away, enter your roster (number and name) and, if you keep the other team too, their roster under it: numbers, names if you have them. Both are optional. Tap Start game. The opponent, date, team and coach are under Game details; left blank, the opponent is the date, for example 11-13. Fix a number, add a name or add a player mid-game: ⋯ → Edit teams.',
      'On iPhone, tap Share, then Add to Home Screen: it keeps your roster saved between games. Theirs is not saved, since the opponent changes.',
    ],
  },
  {
    id: 'play',
    title: 'Record a play',
    body: [
      'Home is on the left with light rows, Away on the right with dark ones, and a small US tag marks your team. To keep your team on the left home or away, turn on ⋯ → Experiments → Our team on the left. A team name you entered shows at the top of its half, under Home or Away.',
      'Each player is a row with their number, so there are no names on the screen. +2 and Foul are one tap on the row. Tap the number, small gray points beside it, for everything else: +3, free throws, a tech, fixes and subs. The list scrolls when a team has more rows than fit. The line above the bar names the team, for example #4 (Home) +2.',
    ],
  },
  {
    id: 'free-throws',
    title: 'Free throws',
    body: ['Tap the number, then FT made or FT missed; the sheet stays open for the second shot. Tap Done when finished.'],
  },
  {
    id: 'no-card',
    title: 'A player with no row',
    body: [
      'Under each half\'s rows is a dashed + Play button. Tap it, pick the play, and Whose number? asks who: type the number to credit that player (a new number joins that team), or tap No number to give it to the team only.',
      'Stop asking this game does the same as No number and skips the question for that team from then on.',
    ],
  },
  {
    id: 'subs',
    title: 'Subs',
    body: [
      "Every row looks the same: the five on the floor come first, and the rows after them are a shade grayer (Home) or darker (Away), after a small gap. The first five on the roster start, and the Sub button beside + Play reads Starters until that team's first play if you want to change them, then Sub. Subbing is optional: a bench player who makes a play goes on the floor on their own, and nothing waits on you. Two seconds after you stop tapping or scrolling, their row moves up into the top five, trading places with the player who has gone longest without a play, the moved rows flash blue and the list scrolls back to the top. For half a second after that, +2 and Foul on that half ignore taps, so a finger already on its way never lands on the row that slid in; the number always works.",
      "When #22 checks in at the table, tap the #22 number, then #22 checks in at the foot of their sheet, then who went out. The Sub button opens the same sheet: Who went out? when more than five are on (longest without a play marks the player who has gone longest without one: only a hint, never acted on), Who came in? when fewer, as after a foul-out, and Who's on the floor? for a line change, ended with Done. Subs change no score or count, and Undo takes one back.",
    ],
    image: { src: '/howto/subs.png', alt: 'Who went out? for Home after #44 scored from the bench: six on the floor, #44 marked just in and #0, whose last play is the oldest, with the hint longest without a play; Cancel below.' },
  },
  {
    id: 'timeouts',
    title: 'Timeouts and bench techs',
    body: [
      "Each team's timeouts are the buttons under its Tech button: Full: 3 means three full ones left, and OT: 1 shows in overtime. One tap takes one. At 0 the button is grayed; a tap asks first, and Take one anyway records it.",
      "Bench and coach techs go on that team's Tech button, beside + Play, which shows the count in amber once there is one, for example Tech 2.",
    ],
  },
  {
    id: 'mistakes',
    title: 'Mistakes',
    body: ['Tap Undo right away, or open Book, then Plays, and tap the line to fix or delete it. Fix can change the play, the team, the player or the quarter, and can move the plays after it too. Book → Players shows each player\'s points and fouls by quarter, for either team, like the book\'s rows. Tap a quarter to see its plays, fix one, or add a missing one to that quarter.', 'Undid one too many? Redo on the line above the bar puts it back, until you enter something new.'],
    image: { src: '/howto/mistakes.png', alt: 'The Plays tab in Book with one play tapped: its fix sheet offers another play, team or player, Delete, Cancel and Save.' },
  },
  {
    id: 'quarter',
    title: 'End of quarter',
    body: [
      "Tap End Q1 (End Q2 and so on; it's outlined in blue, and in red once it can end the game), then type the game score after that quarter, the running score in the book's Score by Qtr box: yours, and theirs if you keep it. The app checks the quarter's own points, so a gap you noted earlier isn't counted twice.",
      'Tap Save when it matches. If not, fix the plays in the list below, or add a missed play with Add play (pick the team first, then the player or No number); it stays there after the score matches, for a foul the book has and the app doesn\'t. Their score only warns, in amber. Later keeps what you typed.',
    ],
    image: { src: '/howto/end-of-quarter.png', alt: "Check Q1 with the book's 8 and 5 typed in: Matches, their score agreeing, and Add play to Q1 above the quarter's plays." },
  },
  {
    id: 'overtime',
    title: 'Overtime and end of game',
    body: [
      'End Q4 offers Start overtime or End game. To stop sooner, tap ⋯ (the three-dot button), then Final / export, then End game early.',
      'Reopen game on the Final screen puts an ended game back in play.',
    ],
  },
  {
    id: 'export',
    title: 'Export',
    body: [
      'Final / export, under the ⋯ button, saves the plays and book files, and never ends the game. Change the game after saving and the files read not saved yet: export again. Saved games clear from this phone after 72 hours.',
      'A quarter marked Not checked exports as pending. One marked Mismatch, with no note, exports as unresolved.',
    ],
  },
  {
    id: 'screen',
    title: 'Reading the screen',
    body: [
      "Each half's header shows that team's fouls for the quarter, amber from 4 (in overtime the count includes Q4). In the bonus, a badge in the strip at the top names the team that shoots, for example Home shoots, over its half. Each row's foul dots turn amber at 4, with an amber ring around the row, and at 5 the row shows a red ring and OUT, with its number grayed. On an out row, +2 and Foul have dashed borders and record nothing: they open the player's sheet, which asks first. A tap that lands twice within a moment records once. The first time you reach this screen on a phone, a tip on the line above the bar reads: Tap a number for 3s, free throws and fixes.",
      `Running score, under ⋯, shows your team only. ${MARK_LEGEND}`,
    ],
    image: { src: '/howto/reading-the-screen.png', alt: 'The live screen in Q1 with both rosters: Home, marked US, on the left with team fouls 5, one row per player showing the number, small gray points, foul dots and two buttons, +2 and Foul, with #12 at four amber foul dots inside an amber ring, and the first shaded row after the top five, #31, fading out at the foot of the scrolling list; Away on the right with its own rows; Away shoots; under each half, + Play beside the Sub and Tech buttons, then the timeout buttons.' },
  },
  {
    id: 'wrong',
    title: "If something's wrong",
    body: [
      'A banner saying Not saving means this phone cannot store the game: keep the paper book current. A reload keeps your plays but clears Undo. The screen stays on during a game where the phone allows it.',
      'When an update is ready, Setup shows an "Update available — reload" button.',
    ],
  },
];
