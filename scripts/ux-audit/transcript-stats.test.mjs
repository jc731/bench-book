import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeTranscript, ALLOWED_TOOLS, HARMLESS_TOOLS } from './transcript-stats.mjs';

const APP = 'http://localhost:4410/';
const line = (...content) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } });
const text = (t) => ({ type: 'text', text: t });
const tool = (name, input = {}) => ({ type: 'tool_use', id: 't1', name, input });
const ux = (bare, input) => tool(`mcp__ux-browser__${bare}`, input);
const jsonl = (...lines) => lines.join('\n');

describe('analyzeTranscript', () => {
  it('allowed-only transcript is not void and counts tools', () => {
    const r = analyzeTranscript(
      jsonl(
        line(ux('browser_navigate', { url: APP })),
        line(ux('browser_snapshot')),
        line(ux('browser_click', { ref: 'a' })),
        line(ux('browser_click', { ref: 'b' })),
      ),
      { appUrl: APP },
    );
    expect(r.void).toBe(false);
    expect(r.reasons).toEqual([]);
    expect(r.toolCounts).toEqual({
      'mcp__ux-browser__browser_navigate': 1,
      'mcp__ux-browser__browser_snapshot': 1,
      'mcp__ux-browser__browser_click': 2,
    });
    expect(r.navigations).toEqual([APP]);
  });

  it('flags a disallowed tool', () => {
    const r = analyzeTranscript(jsonl(line(ux('browser_snapshot')), line(tool('Bash', { command: 'ls' }))), { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain('disallowed tool: Bash');
  });

  it('flags an allowed bare name on a different server', () => {
    const r = analyzeTranscript(line(tool('mcp__other__browser_click', {})), { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain('disallowed tool: mcp__other__browser_click');
  });

  it('flags a same-length look-alike server name', () => {
    const r = analyzeTranscript(line(tool('mcp__ux-browsex__browser_click', {})), { appUrl: APP });
    expect(r.void).toBe(true);
  });

  it('flags a ux-browser tool that is not on the allowlist', () => {
    const r = analyzeTranscript(line(ux('browser_evaluate', {})), { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain('disallowed tool: mcp__ux-browser__browser_evaluate');
  });

  it.each(['file:///home/x', 'http://localhost:4410/_astro/app.js', 'http://evil.test/',
    'not a url',
    'http://localhost:4411/',
    'http://localhost:4410.evil/',
    'view-source:http://localhost:4410/',
    'data:text/html,x',
    'https://localhost:4410/',
  ])('flags navigation to %s', (url) => {
    const r = analyzeTranscript(line(ux('browser_navigate', { url })), { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain(`navigate outside app: ${url}`);
  });

  it.each([APP, `${APP}#/game`, `${APP}?x=1`, 'http://localhost:4410'])('allows navigation to %s', (url) => {
    const r = analyzeTranscript(line(ux('browser_navigate', { url })), { appUrl: APP });
    expect(r.void).toBe(false);
    expect(r.navigations).toEqual([url]);
  });

  it('navigate with no url is void', () => {
    const r = analyzeTranscript(line(ux('browser_navigate', {})), { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain('navigate outside app: ');
  });

  it('empty transcript is void', () => {
    for (const t of ['', '\n\n']) {
      const r = analyzeTranscript(t, { appUrl: APP });
      expect(r.void).toBe(true);
      expect(r.reasons).toEqual(['no persona tool calls found']);
    }
  });

  it('garbage transcript is void as unparseable', () => {
    const r = analyzeTranscript('not json', { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain('unparseable transcript line 1');
  });

  it('a malformed line next to a valid one is void', () => {
    const truncated = line(tool('Bash', { command: 'ls' })).slice(0, -8);
    const r = analyzeTranscript(jsonl(line(ux('browser_snapshot')), truncated), { appUrl: APP });
    expect(r.void).toBe(true);
    expect(r.reasons).toContain('unparseable transcript line 2');
  });

  it('ignores non-assistant lines', () => {
    const user = JSON.stringify({ type: 'user', message: { content: [tool('Bash')] } });
    const r = analyzeTranscript(jsonl(user, line(ux('browser_snapshot'))), { appUrl: APP });
    expect(r.void).toBe(false);
  });

  it('attributes actions to the most recent Event marker; snapshots and waits are not actions', () => {
    const r = analyzeTranscript(
      jsonl(
        line(text('Event 3: tap the thing'), ux('browser_click', { ref: 'a' })),
        line(ux('browser_click', { ref: 'b' })),
        line(ux('browser_snapshot')),
        line(ux('browser_wait_for', { time: 1 })),
        line(text('Event 4: next'), ux('browser_type', { ref: 'c', text: 'x' })),
        line(ux('browser_take_screenshot')),
      ),
      { appUrl: APP },
    );
    expect(r.perEvent[3]).toEqual({ actions: 2 });
    expect(r.perEvent[4]).toEqual({ actions: 1 });
    expect(r.totalActions).toBe(3);
  });

  it('uses the last Event marker when one text block mentions several', () => {
    const r = analyzeTranscript(line(text('Done with Event 1. Event 2: go'), ux('browser_click', {})), { appUrl: APP });
    expect(r.perEvent).toEqual({ 2: { actions: 1 } });
  });

  it('actions before any Event marker count toward the total only', () => {
    const r = analyzeTranscript(line(ux('browser_click', {})), { appUrl: APP });
    expect(r.perEvent).toEqual({});
    expect(r.totalActions).toBe(1);
  });

  it('a back-reference such as "Event 15\'s" does not change the current event', () => {
    const r = analyzeTranscript(
      line(text("Event 28: fixing Event 15's play"), ux('browser_click', {})),
      { appUrl: APP },
    );
    expect(r.perEvent).toEqual({ 28: { actions: 1 } });
  });

  it('ToolSearch is allowed, not an action, and not on the allowlist', () => {
    const r = analyzeTranscript(jsonl(line(tool('ToolSearch', { query: 'x' })), line(ux('browser_snapshot'))), { appUrl: APP });
    expect(r.void).toBe(false);
    expect(r.totalActions).toBe(0);
    expect(ALLOWED_TOOLS).not.toContain('ToolSearch');
    expect(HARMLESS_TOOLS).toEqual(['ToolSearch']);
  });

  describe('prompt check', () => {
    const P = 'You are a bookkeeper.\n\nPlay the game.';
    const user = (content) => JSON.stringify({ type: 'user', message: { role: 'user', content } });
    const body = line(ux('browser_snapshot'));

    it('identical prompt (string content, whitespace differences) is not void', () => {
      const r = analyzeTranscript(jsonl(user('You are a bookkeeper.  Play\nthe game.'), body), { appUrl: APP, prompt: P });
      expect(r.void).toBe(false);
    });

    it('identical prompt as text blocks is not void', () => {
      const r = analyzeTranscript(jsonl(user([{ type: 'text', text: P }]), body), { appUrl: APP, prompt: P });
      expect(r.void).toBe(false);
    });

    it('a changed word is void', () => {
      const r = analyzeTranscript(jsonl(user('You are a bookkeeper. Play the match.'), body), { appUrl: APP, prompt: P });
      expect(r.void).toBe(true);
      expect(r.reasons).toContain('prompt differs from built prompt');
    });

    it('missing prompt text is void', () => {
      const r = analyzeTranscript(body, { appUrl: APP, prompt: P });
      expect(r.void).toBe(true);
      expect(r.reasons).toContain('prompt differs from built prompt');
    });

    it('is not checked when no prompt is given', () => {
      expect(analyzeTranscript(body, { appUrl: APP }).void).toBe(false);
    });
  });

  it('exports the allowlist', () => {
    expect(ALLOWED_TOOLS).toContain('browser_click');
    expect(ALLOWED_TOOLS).not.toContain('browser_evaluate');
    expect(ALLOWED_TOOLS).toHaveLength(10);
  });
});

describe('CLI', () => {
  const script = new URL('./transcript-stats.mjs', import.meta.url).pathname;
  const dir = mkdtempSync(join(tmpdir(), 'ux-stats-'));
  const run = (file) => spawnSync('node', [script, file, APP], { encoding: 'utf8' });

  it('exits 0 and prints JSON for a clean transcript', () => {
    const f = join(dir, 'clean.jsonl');
    writeFileSync(f, line(ux('browser_snapshot')));
    const r = run(f);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).void).toBe(false);
  });

  it('exits 2 for a void transcript', () => {
    const f = join(dir, 'void.jsonl');
    writeFileSync(f, line(tool('Bash', {})));
    const r = run(f);
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout).void).toBe(true);
  });

  it('exits 2 with a clear error for a missing file', () => {
    const r = run(join(dir, 'nope.jsonl'));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('cannot read transcript');
  });

  it('exits 2 when the analysis throws (numeric tool name)', () => {
    const f = join(dir, 'crash.jsonl');
    writeFileSync(f, line({ type: 'tool_use', id: 't', name: 5, input: {} }));
    const r = run(f);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('crashed');
  });

  it('--prompt: exits 0 on a match and 2 on a mismatch', () => {
    const f = join(dir, 'p.jsonl');
    writeFileSync(f, [JSON.stringify({ type: 'user', message: { content: 'hello  world' } }), line(ux('browser_snapshot'))].join('\n'));
    const good = join(dir, 'good.txt');
    const bad = join(dir, 'bad.txt');
    writeFileSync(good, 'hello world\n');
    writeFileSync(bad, 'hello there\n');
    expect(spawnSync('node', [script, f, APP, '--prompt', good], { encoding: 'utf8' }).status).toBe(0);
    const r = spawnSync('node', [script, f, APP, '--prompt', bad], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('prompt differs from built prompt');
  });

  it('exits 2 when --prompt has no file', () => {
    const f = join(dir, 'np.jsonl');
    writeFileSync(f, line(ux('browser_snapshot')));
    expect(spawnSync('node', [script, f, APP, '--prompt'], { encoding: 'utf8' }).status).toBe(2);
  });

  it('exits 2 on missing arguments', () => {
    expect(spawnSync('node', [script], { encoding: 'utf8' }).status).toBe(2);
  });
});
