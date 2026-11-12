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
      'Enter the opponent and Home or Away, then your roster (number and name), and tap Start. The date, team, coach and extras such as keeping their points are under Game details.',
      'On iPhone, tap Share, then Add to Home Screen: it keeps your roster saved between games.',
    ],
  },
  {
    id: 'play',
    title: 'Record a play',
    body: ['Tap the player, then the play: +2, +3, a foul or a free throw.'],
  },
  {
    id: 'free-throws',
    title: 'Free throws',
    body: ['Tap the player, then FT made or FT missed; the sheet stays open for the second shot. Tap Done when finished.'],
  },
  {
    id: 'timeouts',
    title: 'Timeouts and bench techs',
    body: ['Timeout opens Full, 30 and OT. Bench techs are on the Bench card, after the last player.'],
  },
  {
    id: 'theirs',
    title: 'Their points',
    body: ['Turn them on in Game details; then Opp +1, +2 and +3 appear in the bar at the bottom, above Timeout.'],
  },
  {
    id: 'mistakes',
    title: 'Mistakes',
    body: ['Tap Undo right away, or open Log and tap the line to fix or delete it. Fix can also move the plays after it.'],
    image: { src: '/howto/mistakes.png', alt: 'The Log with one play tapped: its fix sheet offers another play or player, Delete, Cancel and Save.' },
  },
  {
    id: 'quarter',
    title: 'End of quarter',
    body: [
      "Tap End Q1 (End Q2 and so on), then type the book's Score by Qtr box into the check.",
      'Tap Save when it matches. If not, fix the plays in the list below, or add a missed one. Later keeps what you typed.',
    ],
    image: { src: '/howto/end-of-quarter.png', alt: "Check Q1 with the book's 8 and 5 typed in, showing Matches above the Later and Save buttons." },
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
      'Foul dots turn amber at 4 and red at OUT. The strip at the top shows the bonus and timeouts left.',
      MARK_LEGEND,
    ],
    image: { src: '/howto/reading-the-screen.png', alt: 'The live screen in Q1: the score, team fouls 5 with the bonus, and timeouts left at the top, and #12 with four amber foul dots.' },
  },
  {
    id: 'wrong',
    title: "If something's wrong",
    body: [
      'A banner saying Not saving means this phone cannot store the game: keep the paper book current. A reload keeps your plays but clears Undo.',
      'When an update is ready, Setup shows an "Update available — reload" button.',
    ],
  },
];
