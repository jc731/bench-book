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
      'Pick Home or Away, enter your roster (number and name) and, if you keep the other team too, their roster under it: numbers, names if you have them. Both are optional. Tap Start game. The opponent, date, team and coach are under Game details; left blank, the opponent is the date, for example 11-13.',
      'On iPhone, tap Share, then Add to Home Screen: it keeps your roster saved between games. Theirs is not saved, since the opponent changes.',
    ],
  },
  {
    id: 'play',
    title: 'Record a play',
    body: [
      'Home is on the left with light cards, Away on the right with dark ones, and a small US tag marks your team.',
      'Tap any player, on either team, then the play: +2, +3, a foul or a free throw. The line above the bar names the team, for example #4 (Home) +2.',
    ],
  },
  {
    id: 'free-throws',
    title: 'Free throws',
    body: ['Tap the player, then FT made or FT missed; the sheet stays open for the second shot. Tap Done when finished.'],
  },
  {
    id: 'no-card',
    title: 'A player with no card',
    body: [
      'Each half ends with a + Play card. Tap it, pick the play, and Whose number? asks who: type the number to credit that player (a new number joins that team), or tap No number to give it to the team only.',
      'Stop asking this game does the same as No number and skips the question for that team from then on.',
    ],
  },
  {
    id: 'timeouts',
    title: 'Timeouts and bench techs',
    body: [
      "Each team's timeouts are the buttons under its Bench card: Full: 3 means three full ones left, and OT: 1 shows in overtime. One tap takes one. At 0 the button is grayed; a tap asks first, and Take one anyway records it.",
      "Bench and coach techs go on that team's Bench / coach tech card, which counts them.",
    ],
  },
  {
    id: 'mistakes',
    title: 'Mistakes',
    body: ['Tap Undo right away, or open Log and tap the line to fix or delete it. Fix can change the play, the team, the player or the quarter, and can move the plays after it too.', 'Undid one too many? Redo on the line above the bar puts it back, until you enter something new.'],
    image: { src: '/howto/mistakes.png', alt: 'The Log with one play tapped: its fix sheet offers another play, team or player, Delete, Cancel and Save.' },
  },
  {
    id: 'quarter',
    title: 'End of quarter',
    body: [
      "Tap End Q1 (End Q2 and so on; it's outlined in blue, and in red once it can end the game), then type the game score after that quarter, the running score in the book's Score by Qtr box: yours, and theirs if you keep it. The app checks the quarter's own points, so a gap you noted earlier isn't counted twice.",
      'Tap Save when it matches. If not, fix the plays in the list below, or add a missed one of yours with Add play; it stays there after the score matches, for a foul the book has and the app doesn\'t. Their score only warns, in amber. Later keeps what you typed.',
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
      "Each half's header shows that team's fouls this quarter, amber from 4. In the bonus, the strip at the top says which team shoots, over its half. Foul dots turn amber at 4 and red at OUT, and an out player's card is grayed: tapping it asks first.",
      `Running score, under ⋯, shows your team only. ${MARK_LEGEND}`,
    ],
    image: { src: '/howto/reading-the-screen.png', alt: 'The live screen in Q1: Home, marked US, on the left with team fouls 5 and #12 at four amber foul dots; Away shoots; under each half, + Play, the Bench card and the timeout buttons.' },
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
