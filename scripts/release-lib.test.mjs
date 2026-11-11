import { describe, expect, it } from 'vitest';
import { bumpVersion, executeRelease, moveUnreleased, planRelease } from './release-lib.mjs';

const CHANGELOG = `# Changelog

Intro text.

## [Unreleased]

- Added thing one.
- Added thing two.

## [0.1.0] - 2026-11-10

- First release.
`;

const EMPTY = CHANGELOG.replace('- Added thing one.\n- Added thing two.\n\n', '');

const good = {
  branch: 'master',
  clean: true,
  tags: [],
  version: '0.1.0',
  kind: 'minor',
  changelog: CHANGELOG,
  date: '2026-11-20',
};

describe('bumpVersion', () => {
  it('bumps minor, patch and major', () => {
    expect(bumpVersion('0.1.0', 'minor')).toBe('0.2.0');
    expect(bumpVersion('0.1.3', 'patch')).toBe('0.1.4');
    expect(bumpVersion('0.9.2', 'major')).toBe('1.0.0');
  });
  it('resets lower parts on minor', () => {
    expect(bumpVersion('0.1.3', 'minor')).toBe('0.2.0');
  });
  it('throws on a non x.y.z version', () => {
    expect(() => bumpVersion('0.1', 'minor')).toThrow();
  });
  it('throws on a bad kind', () => {
    expect(() => bumpVersion('0.1.0', 'huge')).toThrow();
  });
});

describe('moveUnreleased', () => {
  it('moves the bullets under the new version and keeps an empty Unreleased on top', () => {
    const out = moveUnreleased(CHANGELOG, '0.2.0', '2026-11-20');
    expect(out.match(/^## \[Unreleased\]$/gm)).toHaveLength(1);
    expect(out).toContain(
      '## [Unreleased]\n\n## [0.2.0] - 2026-11-20\n\n- Added thing one.\n- Added thing two.\n\n## [0.1.0] - 2026-11-10\n\n- First release.\n',
    );
    expect(out.startsWith('# Changelog\n\nIntro text.\n\n')).toBe(true);
  });
  it('throws when Unreleased is empty', () => {
    expect(() => moveUnreleased(EMPTY, '0.2.0', '2026-11-20')).toThrow(/Unreleased is empty/);
  });
  it('throws when there is no Unreleased heading', () => {
    expect(() => moveUnreleased('# Changelog\n\n## [0.1.0] - 2026-11-10\n\n- A.\n', '0.2.0', '2026-11-20')).toThrow(/Unreleased/);
  });
  it('finds headings in a CRLF changelog', () => {
    const crlf = CHANGELOG.replace(/\n/g, '\r\n');
    const out = moveUnreleased(crlf, '0.2.0', '2026-11-20');
    expect(out).toContain('## [0.2.0] - 2026-11-20\n');
    expect(out).toContain('- Added thing one.\r');
    expect(() => moveUnreleased(EMPTY.replace(/\n/g, '\r\n'), '0.2.0', '2026-11-20')).toThrow(/Unreleased is empty/);
  });
  it('works when Unreleased is the last section', () => {
    const only = '# Changelog\n\n## [Unreleased]\n\n- A.\n';
    expect(moveUnreleased(only, '0.1.0', '2026-01-01')).toBe(
      '# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-01-01\n\n- A.\n',
    );
  });
});

describe('planRelease', () => {
  it('plans a release on the happy path', () => {
    const plan = planRelease(good);
    expect(plan.ok).toBe(true);
    expect(plan.next).toBe('0.2.0');
    expect(plan.newChangelog).toContain('## [0.2.0] - 2026-11-20');
    expect(plan.newChangelog).toBe(moveUnreleased(CHANGELOG, '0.2.0', '2026-11-20'));
  });
  it('refuses off master', () => {
    expect(planRelease({ ...good, branch: 'feature' })).toEqual({ ok: false, reason: 'not on master' });
  });
  it('refuses a dirty tree', () => {
    expect(planRelease({ ...good, clean: false })).toEqual({ ok: false, reason: 'working tree not clean' });
  });
  it('refuses an empty Unreleased', () => {
    expect(planRelease({ ...good, changelog: EMPTY })).toEqual({ ok: false, reason: 'Unreleased is empty' });
  });
  it('refuses an existing tag', () => {
    expect(planRelease({ ...good, tags: ['v0.2.0'] })).toEqual({ ok: false, reason: 'tag v0.2.0 exists' });
  });
  it('reports failures in the documented order', () => {
    expect(planRelease({ ...good, branch: 'x', clean: false, changelog: EMPTY, tags: ['v0.2.0'] }).reason).toBe('not on master');
    expect(planRelease({ ...good, clean: false, changelog: EMPTY, tags: ['v0.2.0'] }).reason).toBe('working tree not clean');
    expect(planRelease({ ...good, changelog: EMPTY, tags: ['v0.2.0'] }).reason).toBe('Unreleased is empty');
  });
});

describe('executeRelease', () => {
  const make = (fail = '') => {
    const calls = [];
    const msgs = [];
    const step = (name) => () => {
      calls.push(name);
      if (name === fail) throw new Error(name);
    };
    const steps = Object.fromEntries(['check', 'e2e', 'shots', 'write', 'commit', 'tag'].map((n) => [n, step(n)]));
    return { calls, msgs, steps, say: (m) => msgs.push(m) };
  };
  it('runs every step in order and exits 0', () => {
    const t = make();
    expect(executeRelease('0.2.0', t.steps, t.say)).toBe(0);
    expect(t.calls).toEqual(['check', 'e2e', 'shots', 'write', 'commit', 'tag']);
    expect(t.msgs).toEqual(['Released v0.2.0. Push when ready: git push && git push --tags']);
  });
  it.each(['check', 'e2e'])('writes nothing when %s fails', (fail) => {
    const t = make(fail);
    expect(executeRelease('0.2.0', t.steps, t.say)).toBe(1);
    expect(t.calls).not.toContain('write');
    expect(t.calls).not.toContain('commit');
  });
  it('writes nothing when the screenshots fail, and says how to restore the images', () => {
    const t = make('shots');
    expect(executeRelease('0.2.0', t.steps, t.say)).toBe(1);
    expect(t.calls).toEqual(['check', 'e2e', 'shots']);
    expect(t.msgs).toEqual(['Screenshots failed; nothing was released. Restore the images with: git checkout -- public/howto']);
  });
  it('explains how to restore when the commit fails, and does not tag', () => {
    const t = make('commit');
    expect(executeRelease('0.2.0', t.steps, t.say)).toBe(1);
    expect(t.calls).not.toContain('tag');
    expect(t.msgs[0]).toMatch(/git checkout -- package\.json CHANGELOG\.md public\/howto$/);
  });
  it('says how to tag by hand when only the tag fails', () => {
    const t = make('tag');
    expect(executeRelease('0.2.0', t.steps, t.say)).toBe(1);
    expect(t.msgs).toEqual(['Committed Release v0.2.0 but tagging failed; run: git tag v0.2.0']);
  });
});
