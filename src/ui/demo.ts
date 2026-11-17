import { isDemo, storageKeys } from '../core/keys';
import type { Player } from '../core/types';

/** True when this page was opened with `?demo`. */
export function demoActive(): boolean {
  return typeof window !== 'undefined' && isDemo(window.location.search);
}

const p = (id: string, number: string, name: string, pos: string): Player => ({ id, number, name, pos });

export const DEMO_SETUP: { team: string; opponent: string; ours: Player[]; theirs: Player[] } = {
  team: 'Demo Hawks',
  opponent: 'Demo Wolves',
  ours: [
    p('demo-o1', '3', 'Sam Rivera', 'G'),
    p('demo-o2', '5', 'Jordan Pike', 'G'),
    p('demo-o3', '10', 'Casey Lund', 'F'),
    p('demo-o4', '12', 'Riley Okafor', 'F'),
    p('demo-o5', '21', 'Morgan Hale', 'C'),
    p('demo-o6', '24', 'Taylor Brandt', 'G'),
    p('demo-o7', '32', 'Avery Quill', 'F'),
    p('demo-o8', '44', 'Drew Santos', 'C'),
  ],
  theirs: [
    p('demo-t1', '1', 'Alex Moreau', 'G'),
    p('demo-t2', '4', 'Blake Nunez', 'G'),
    p('demo-t3', '11', 'Cameron Fitch', 'F'),
    p('demo-t4', '15', 'Devon Larkin', 'F'),
    p('demo-t5', '20', 'Emery Voss', 'C'),
    p('demo-t6', '23', 'Finley Crane', 'G'),
    p('demo-t7', '33', 'Harper Dunn', 'F'),
    p('demo-t8', '50', 'Indy Marsh', 'C'),
  ],
};

/** Clears the demo game, roster and prefs only; the real keys are never named here. */
export function resetDemo(s: Storage): void {
  const k = storageKeys(true);
  for (const key of [k.game, k.roster, k.prefs]) {
    try {
      s.removeItem(key);
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }
}
