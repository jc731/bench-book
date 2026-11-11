// `pnpm release <major|minor|patch>`: the only way versions get bumped.
// Runs every check, then bumps, moves the changelog, commits and tags. Never pushes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { planRelease } from './release-lib.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const pnpm = (...args) => execFileSync('pnpm', args, { stdio: 'inherit' });

const kind = process.argv[2] ?? '';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');

let plan;
try {
  plan = planRelease({
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    clean: git('status', '--porcelain') === '',
    tags: git('tag').split('\n').filter(Boolean),
    version: pkg.version,
    kind,
    changelog,
    date: new Date().toISOString().slice(0, 10),
  });
} catch (e) {
  console.error(`${e.message}\nUsage: pnpm release <major|minor|patch>`);
  process.exit(1);
}
if (!plan.ok) {
  console.error(plan.reason);
  process.exit(1);
}

try {
  pnpm('check');
  pnpm('test:e2e');
} catch {
  console.error('Checks failed; nothing was written.');
  process.exit(1);
}

pkg.version = plan.next;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync('CHANGELOG.md', plan.newChangelog);
git('commit', '-am', `Release v${plan.next}`);
git('tag', `v${plan.next}`);
console.log(`Released v${plan.next}. Push when ready: git push && git push --tags`);
