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

export function analyzeTranscript(jsonlText, { appUrl }) {
  const reasons = [];
  const toolCounts = {};
  const navigations = [];
  const perEvent = {};
  let totalActions = 0;
  let sawTool = false;
  let currentEvent = null;

  for (const raw of jsonlText.split('\n')) {
    if (!raw.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    if (entry?.type !== 'assistant') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        const markers = [...block.text.matchAll(/\bEvent\s+(\d+)/g)];
        if (markers.length) currentEvent = Number(markers[markers.length - 1][1]);
      } else if (block.type === 'tool_use') {
        sawTool = true;
        const name = block.name;
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

  if (!sawTool) reasons.push('no persona tool calls found');
  return { void: reasons.length > 0, reasons, toolCounts, navigations, perEvent, totalActions };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [file, appUrl] = process.argv.slice(2);
  if (!file || !appUrl) {
    console.error('usage: node transcript-stats.mjs <transcript.jsonl> <appUrl>');
    process.exit(64);
  }
  const result = analyzeTranscript(readFileSync(file, 'utf8'), { appUrl });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.void ? 2 : 0);
}
