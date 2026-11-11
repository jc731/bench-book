// Pure helpers for `pnpm release`. No I/O here, so every rule is unit-tested.

/**
 * @param {string} version x.y.z
 * @param {'major'|'minor'|'patch'} kind
 * @returns {string}
 */
export function bumpVersion(version, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Version must be x.y.z, got "${version}"`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Kind must be major, minor or patch, got "${kind}"`);
}

/**
 * Move the Unreleased entries under a new dated version heading and keep an
 * empty Unreleased section on top.
 * @param {string} changelog
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function moveUnreleased(changelog, version, date) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => l.replace(/\r$/, '') === '## [Unreleased]');
  if (start === -1) throw new Error('No ## [Unreleased] heading');
  let end = lines.findIndex((l, i) => i > start && l.replace(/\r$/, '').startsWith('## ['));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end);
  while (body.length && body[0].trim() === '') body.shift();
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  if (body.length === 0) throw new Error('Unreleased is empty');
  const rest = lines.slice(end);
  return [
    ...lines.slice(0, start + 1),
    '',
    `## [${version}] - ${date}`,
    '',
    ...body,
    ...(rest.length ? ['', ...rest] : ['']),
  ].join('\n');
}

/**
 * @param {{ branch: string, clean: boolean, tags: string[], version: string,
 *   kind: string, changelog: string, date: string }} facts
 * @returns {{ ok: true, next: string, newChangelog: string } | { ok: false, reason: string }}
 */
export function planRelease({ branch, clean, tags, version, kind, changelog, date }) {
  if (branch !== 'master') return { ok: false, reason: 'not on master' };
  if (!clean) return { ok: false, reason: 'working tree not clean' };
  const next = bumpVersion(version, kind);
  let newChangelog;
  try {
    newChangelog = moveUnreleased(changelog, next, date);
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  if (tags.includes(`v${next}`)) return { ok: false, reason: `tag v${next} exists` };
  return { ok: true, next, newChangelog };
}

/**
 * Run the release steps in order, reporting each failure with a recovery hint.
 * Steps are injected so the sequencing is testable without git or pnpm.
 * @param {string} next version being released, e.g. '0.2.0'
 * @param {{ check: () => void, e2e: () => void, shots: () => void, write: () => void,
 *   commit: () => void, tag: () => void }} steps
 * @param {(msg: string) => void} say
 * @returns {number} process exit code
 */
export function executeRelease(next, steps, say) {
  try {
    steps.check();
    steps.e2e();
  } catch {
    say('Checks failed; nothing was written.');
    return 1;
  }
  try {
    steps.shots();
  } catch {
    say('Screenshots failed; nothing was released. Restore the images with: git checkout -- public/howto');
    return 1;
  }
  steps.write();
  try {
    steps.commit();
  } catch {
    say('package.json, CHANGELOG.md and the How-to images were written but not committed. Restore with: git checkout -- package.json CHANGELOG.md public/howto');
    return 1;
  }
  try {
    steps.tag();
  } catch {
    say(`Committed Release v${next} but tagging failed; run: git tag v${next}`);
    return 1;
  }
  say(`Released v${next}. Push when ready: git push && git push --tags`);
  return 0;
}
