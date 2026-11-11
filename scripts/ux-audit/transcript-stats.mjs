// Checks a persona subagent transcript (Claude Code JSONL) for disallowed tools and
// off-app navigation, and counts actions per "Event N" marker.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SERVER = 'ux-browser';

export const ALLOWED_TOOLS = [
  'browser_snapshot',
  'browser_take_screenshot',
  'browser_click',
  'browser_type',
  'browser_fill_form',
  'browser_press_key',
  'browser_wait_for',
  'browser_navigate',
  'browser_select_option',
  'browser_handle_dialog',
];

// Deferred tool loading only returns schemas: allowed, never an action, never in ALLOWED_TOOLS.
export const HARMLESS_TOOLS = ['ToolSearch'];

// Looking and waiting are not actions.
const NON_ACTIONS = new Set(['browser_snapshot', 'browser_take_screenshot', 'browser_wait_for']);

/** Bare tool name when `name` is an allowed tool on the ux-browser server, else null. */
function allowedBareName(name) {
  const prefix = `mcp__${SERVER}__`;
  if (!name.startsWith(prefix)) return null;
  const bare = name.slice(prefix.length);
  return ALLOWED_TOOLS.includes(bare) ? bare : null;
}

function isAppUrl(url, appUrl) {
  try {
    const u = new URL(url);
    const a = new URL(appUrl);
    return u.origin === a.origin && u.pathname === a.pathname;
  } catch {
    return false;
  }
}

const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

/** Text of a user message's content: a string, or an array of text blocks. */
function userText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

export function analyzeTranscript(jsonlText, { appUrl, prompt }) {
  const reasons = [];
  const toolCounts = {};
  const navigations = [];
  const perEvent = {};
  let totalActions = 0;
  let sawTool = false;
  let currentEvent = null;
  let firstUserText = null;

  const lines = jsonlText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      // A line we cannot read might hide a disallowed tool: fail closed.
      reasons.push(`unparseable transcript line ${i + 1}`);
      continue;
    }
    if (entry?.type === 'user' && firstUserText === null) {
      firstUserText = userText(entry.message?.content);
    }
    if (entry?.type !== 'assistant') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === 'text' && typeof block.text === 'string') {
        const markers = [...block.text.matchAll(/\bEvent\s+(\d+):/g)];
        if (markers.length) currentEvent = Number(markers[markers.length - 1][1]);
      } else if (block?.type === 'tool_use') {
        sawTool = true;
        const name = block.name;
        if (HARMLESS_TOOLS.includes(name)) continue;
        toolCounts[name] = (toolCounts[name] ?? 0) + 1;
        const bare = allowedBareName(name);
        if (!bare) {
          const reason = `disallowed tool: ${name}`;
          if (!reasons.includes(reason)) reasons.push(reason);
          continue;
        }
        if (bare === 'browser_navigate') {
          const url = String(block.input?.url ?? '');
          navigations.push(url);
          const reason = `navigate outside app: ${url}`;
          if (!isAppUrl(url, appUrl) && !reasons.includes(reason)) reasons.push(reason);
        }
        if (!NON_ACTIONS.has(bare)) {
          totalActions++;
          if (currentEvent !== null) {
            perEvent[currentEvent] ??= { actions: 0 };
            perEvent[currentEvent].actions++;
          }
        }
      }
    }
  }

  if (prompt !== undefined && (firstUserText === null || norm(firstUserText) !== norm(prompt))) {
    reasons.push('prompt differs from built prompt');
  }
  if (!sawTool) reasons.push('no persona tool calls found');
  return { void: reasons.length > 0, reasons, toolCounts, navigations, perEvent, totalActions };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // Every failure exits 2, so a caller treats anything but 0 as void.
  const args = process.argv.slice(2);
  let promptFile;
  const pi = args.indexOf('--prompt');
  if (pi !== -1) {
    promptFile = args[pi + 1];
    args.splice(pi, 2);
  }
  const [file, appUrl] = args;
  if (!file || !appUrl || (pi !== -1 && !promptFile)) {
    console.error('usage: node transcript-stats.mjs <transcript.jsonl> <appUrl> [--prompt <file>]');
    process.exit(2);
  }
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`cannot read transcript ${file}: ${e.message}`);
    process.exit(2);
  }
  let prompt;
  if (promptFile) {
    try {
      prompt = readFileSync(promptFile, 'utf8');
    } catch (e) {
      console.error(`cannot read prompt ${promptFile}: ${e.message}`);
      process.exit(2);
    }
  }
  let result;
  try {
    result = analyzeTranscript(text, { appUrl, prompt });
  } catch (e) {
    console.error(`transcript check crashed: ${e.message}`);
    process.exit(2);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.void ? 2 : 0);
}
