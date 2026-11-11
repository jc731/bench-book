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
      'Enter the opponent and your roster, then tap Start; turn on extras such as their points under Game details.',
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
    body: ['Turn them on in Game details; then Opp +1, +2 and +3 sit above the players.'],
  },
  {
    id: 'mistakes',
    title: 'Mistakes',
    body: ['Tap Undo right away, or open Log and tap the line to fix or delete it.'],
  },
  {
    id: 'quarter',
    title: 'End of quarter',
    body: [
      "Tap End Qn, then type the book's Score by Qtr box into the check. Save when it matches; Later keeps what you typed for afterward.",
      'If it does not match, tap the line that is off in Log, or use Add play to Qn for a play you missed.',
    ],
  },
  {
    id: 'overtime',
    title: 'Overtime and end of game',
    body: [
      'After Q4, End Q4 offers Start overtime or End game. To stop sooner, open ⋯, Final / export, then End game early.',
      'Reopen game on the Final screen puts an ended game back in play.',
    ],
  },
  {
    id: 'export',
    title: 'Export',
    body: [
      'Final / export in ⋯ saves the plays and book files, and never ends the game. Saved games clear from this phone after 72 hours.',
      'Quarters still open export as pending, and unresolved if their check was not finished.',
    ],
  },
  {
    id: 'screen',
    title: 'Reading the screen',
    body: [
      'Foul dots turn amber at 4 and red at OUT; the bonus and timeouts left show in the strip at the top.',
      MARK_LEGEND,
    ],
  },
  {
    id: 'wrong',
    title: "If something's wrong",
    body: [
      'A banner saying Not saving means this phone cannot store the game: keep the paper book current. A reload keeps your plays but clears Undo.',
      'The app updates itself when online.',
    ],
  },
];
