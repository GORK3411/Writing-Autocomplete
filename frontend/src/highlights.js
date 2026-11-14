import * as api from "./api.js";
import { overlaps, spanToEdit } from "./edits.js";

const CLOSER = { '"': '"', "[": "]", "{": "}" };
const KIND = { '"': "desc", "[": "lang", "{": "idiom" };
const TITLE = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|e\.g|i\.e)\.$/i;
const INITIAL = /(?:^|\s)[A-Z]\.$/;
const cache = new Map();
const inflight = new Map();
const waiting = [];
let activeRequests = 0;

function requestSlot(request, signal) {
  return new Promise((resolve, reject) => {
    function run() {
      if (signal.aborted) {
        resolve(undefined);
        waiting.shift()?.();
        return;
      }
      activeRequests++;
      Promise.resolve().then(request).then(resolve, reject).finally(() => {
        activeRequests--;
        waiting.shift()?.();
      });
    }
    if (activeRequests < 4) run();
    else waiting.push(run);
  });
}

function isInternalPeriod(text, start, index) {
  const next = text[index + 1] ?? "";
  // Decimal points and dots inside words are not sentence boundaries.
  if (/\S/.test(next) && !".!?".includes(next)) return true;
  const prefix = text.slice(Math.max(start, index - 12), index + 1);
  return (TITLE.test(prefix) || INITIAL.test(prefix)) && /^\s+\w/.test(text.slice(index + 1));
}

// Scan once. Trigger punctuation belongs to the trigger. Blank lines end a paragraph.
export function splitDraft(text) {
  const chunks = [];
  let start = 0;
  let triggers = [];
  function finish(end, complete) {
    const raw = text.slice(start, end);
    if (!raw) return;
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (lead) chunks.push({ text: raw.slice(0, lead) });
    if (body) {
      const bodyEnd = start + lead + body.length;
      const clipped = triggers.map((trigger) => ({
        ...trigger, text: trigger.text.slice(0, bodyEnd - trigger.start),
      }));
      chunks.push({ text: body, start: start + lead, complete, triggers: clipped });
    }
    const trail = raw.slice(lead + body.length);
    if (trail) chunks.push({ text: trail });
    start = end;
    triggers = [];
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (CLOSER[char]) {
      let end = i + 1;
      while (end < text.length && text[end] !== CLOSER[char] && text[end] !== "\n") end++;
      const open = text[end] !== CLOSER[char];
      if (!open) end++;
      triggers.push({ start: i, text: text.slice(i, end), kind: KIND[char], open, mark: "trig" });
      i = end - 1;
      continue;
    }
    if (char === "\n" && /^[ \t\r]*\n/.test(text.slice(i + 1))) {
      finish(i + 1, false);
      continue;
    }
    if (!".!?".includes(char)) continue;
    if (char === "." && isInternalPeriod(text, start, i)) continue;
    while (i + 1 < text.length && ".!?".includes(text[i + 1])) i++;
    finish(i + 1, true);
  }
  finish(text.length, false);
  return chunks;
}

const keyOf = (name, sentence) => name + "\0" + sentence;

function cachedRequest(name, sentence, request, signal) {
  const key = keyOf(name, sentence);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (!inflight.has(key)) {
    inflight.set(key, requestSlot(request, signal).then((answer) => {
      if (answer === undefined) return undefined;
      cache.set(key, answer);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return answer;
    }).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

export function highlightsNow(text) {
  return splitDraft(text).map((chunk) => {
    if (chunk.start === undefined) return { ...chunk, parts: [{ text: chunk.text }], fixes: [] };
    const { text: sentence, start, triggers } = chunk;
    const difficulty = cache.get(keyOf("difficulty", sentence));
    const taken = triggers.map((t) => ({ start: t.start, from: t.text }));
    const fixes = [];
    const grammar = cache.get(keyOf("grammar", sentence));
    const spelling = cache.get(keyOf("spelling", sentence));
    for (const [mark, spans] of [["err", grammar ?? spelling], ["hard", cache.get(keyOf("hard", sentence))],
      ["better", cache.get(keyOf("better", sentence))]]) {
      for (const span of spans ?? []) {
        const edit = spanToEdit(sentence, span, start);
        if (!edit || taken.some((other) => overlaps(edit, other))) continue;
        taken.push(edit);
        fixes.push({ ...edit, mark });
      }
    }
    const marks = [...triggers, ...fixes.filter((fix) => fix.from).map((fix) => ({
      start: fix.start, text: fix.from, mark: fix.mark,
    }))].sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = start;
    for (const mark of marks) {
      if (cursor < mark.start) parts.push({ text: text.slice(cursor, mark.start) });
      parts.push(mark);
      cursor = mark.start + mark.text.length;
    }
    if (cursor < start + sentence.length) parts.push({ text: text.slice(cursor, start + sentence.length) });
    return { ...chunk, difficulty, hardSentence: !!difficulty?.hard, parts, fixes };
  });
}

export async function computeHighlights(text, mode, signal, onUpdate) {
  const tasks = [];
  for (const chunk of splitDraft(text)) {
    const sentence = chunk.text;
    if (chunk.start === undefined || [...sentence].length > api.MAX_SENTENCE ||
        chunk.triggers.some((trigger) => trigger.open)) continue;
    const add = (name, request) => tasks.push(() => cachedRequest(name, sentence, request, signal));
    if (mode === "light") {
      if (chunk.complete) add("difficulty", () => api.difficulty(sentence));
      add("hard", () => api.hardWords(sentence));
      add("better", () => api.betterWords(sentence));
      add("spelling", () => api.grammar(sentence, false));
    } else if (chunk.complete || mode === "check") {
      if (!chunk.triggers.length) add("grammar", () => api.grammar(sentence, true));
    }
  }
  let next = 0;
  let failed = false;
  async function worker() {
    while (!signal.aborted && next < tasks.length) {
      try {
        const task = tasks[next++];
        // A newer analysis can encounter a cancelled task for the same sentence.
        if (await task() === undefined && !signal.aborted) await task();
      } catch {
        failed = true;
      }
      if (!signal.aborted) onUpdate();
    }
  }
  await Promise.all(Array.from({ length: mode === "light" ? 3 : 1 }, worker));
  return failed;
}

export function overallDifficulty(chunks) {
  let total = 0;
  let weight = 0;
  let hardest = null;
  chunks.filter((chunk) => chunk.start !== undefined).forEach((chunk, index) => {
    if (!chunk.difficulty) return;
    const { score } = chunk.difficulty;
    total += score * chunk.text.length;
    weight += chunk.text.length;
    if (!hardest || score > hardest.score) hardest = { score, index };
  });
  return weight ? { score: Math.round(total / weight), hardest: hardest.index + 1 } : null;
}

export function listFixes(chunks) {
  return chunks.flatMap((chunk) => chunk.fixes).sort((a, b) => a.start - b.start);
}
