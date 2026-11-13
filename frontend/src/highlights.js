// Inline highlights painted behind the text (same colors everywhere in the UI):
//   yellow marker = hard word          (feature 7)    -> POST /api/hard-words
//   blue marker   = better word        (feature 8)    -> POST /api/better-words
//   pink          = hard sentence      (features 5/6) -> POST /api/difficulty, /api/simplify
//   red squiggle  = spelling & grammar (feature 9)    -> POST /api/grammar
//
// The models live in the backend (backend/app/features/). This file only splits the
// text into sentences, asks the backend about each one, and turns the answers into
// highlighted parts for the mirror.
//
// Every answer is cached per sentence, so only new or edited sentences are sent:
//   - highlightsNow(text) is synchronous and uses cached answers only, so the mirror
//     always matches the current text (a sentence not answered yet has no marks);
//   - computeHighlights(text) asks for everything missing, waits, and returns the
//     complete result.

import * as api from "./api.js";

// The most important mark wins when spans overlap: an error, then a hard word, then a better word.
const SPAN_CHECKS = [
  ["err", api.grammar], // feature 9
  ["hard", api.hardWords], // feature 7
  ["better", api.betterWords], // feature 8
];

// ---------------------------------------------------------------------------
// Cache of backend answers
// ---------------------------------------------------------------------------

const CACHE_LIMIT = 5000;
const RETRY_MS = 5000; // after a failed call (e.g. backend not started), wait before asking again
const cache = new Map(); // key -> answer
const inflight = new Map(); // key -> Promise of the answer
const failedAt = new Map(); // key -> time of the last failure

/**
 * Cached answer for `key`, or undefined if it isn't known yet. In that case `fn` is
 * called (once, even if several callers ask) and its promise is pushed to `pending`.
 * A failed call is logged and not cached, so it is retried later.
 */
function ask(key, fn, pending) {
  if (cache.has(key)) return cache.get(key);
  let p = inflight.get(key);
  if (!p) {
    if (Date.now() - (failedAt.get(key) ?? -Infinity) < RETRY_MS) return undefined;
    p = Promise.resolve()
      .then(fn)
      .then(
        (value) => {
          cache.set(key, value);
          if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value); // drop the oldest
          failedAt.delete(key);
          return value;
        },
        (e) => {
          console.warn("[highlights]", e.message ?? e);
          failedAt.set(key, Date.now());
          return undefined;
        },
      )
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  pending?.push(p);
  return undefined;
}

/** Await one cached call. */
async function cached(key, fn) {
  const pending = [];
  const value = ask(key, fn, pending);
  return pending.length ? pending[0] : value;
}

const keyOf = (...args) => JSON.stringify(args);

// ---------------------------------------------------------------------------
// Splitting the text into sentences / triggers / marked spans
// ---------------------------------------------------------------------------

// Text inside "...", [...] or {...} (closed or still being typed) is about to be
// replaced by features 1-3: it gets the blue "find" box, never a word highlight.
const TRIGGER_SRC = String.raw`"[^"]*"?|\[[^\]]*\]?|\{[^}]*\}?`;
const TRIGGER_KIND = { '"': "desc", "[": "lang", "{": "idiom" }; // features 1, 2, 3
const TRIGGER_CLOSE = { '"': '"', "[": "]", "{": "}" };
// A sentence = anything up to and including its end punctuation. A trigger counts as
// one block, so a "." typed inside "..." doesn't end the sentence.
const SENTENCE_RE = new RegExp(String.raw`(?:${TRIGGER_SRC}|[^.!?"\[{])+[.!?]*|[.!?]+`, "g");
const TRIGGER_RE = new RegExp(TRIGGER_SRC, "g");

/**
 * The backend's offsets are Python indices (code points); JS strings index UTF-16
 * units. They differ only after characters outside the BMP (e.g. emoji).
 */
function codePointToIndex(str) {
  const units = [0];
  for (const ch of str) units.push(units.at(-1) + ch.length);
  return (cp) => units[cp];
}

/**
 * Backend spans -> [{ at, end, text, suggestion }] in JS offsets. Spans whose offsets
 * don't match the sentence are ignored rather than painting the wrong word.
 */
function toUnits(body, list) {
  const toIndex = codePointToIndex(body);
  return list.flatMap((s) => {
    const at = toIndex(s.start);
    const end = toIndex(s.end);
    if (at === undefined || end === undefined || at >= end || body.slice(at, end) !== s.text) return [];
    return [{ at, end, text: s.text, suggestion: s.suggestion }];
  });
}

/** Cached answers for one sentence body (undefined = not known yet). */
function answersOf(body, finished, get) {
  if (body.length > api.MAX_SENTENCE) return { difficulty: null, spans: [] };
  return {
    // Feature 5: only finished sentences get a difficulty score.
    difficulty: finished ? get(keyOf("difficulty", body), () => api.difficulty(body)) : null,
    // Features 7-9: the sentence being typed is checked too (its last word is dropped in findSpans).
    spans: SPAN_CHECKS.map(([mark, fn]) => [mark, get(keyOf(mark, body), () => fn(body).then((l) => toUnits(body, l)))]),
  };
}

// ---------------------------------------------------------------------------
// Keeping the marks of a sentence while it is being edited
// ---------------------------------------------------------------------------
// Each keystroke turns the edited sentence into a new, not-yet-answered text. Until
// the backend answers it, the answers of its previous version are reused: marks
// before and after the edit are moved to their new place, marks touching the edit
// are dropped.

let lastShown = new Map(); // sentence body -> answers shown for it on the last render

function commonEnds(a, b) {
  const max = Math.min(a.length, b.length);
  let p = 0;
  while (p < max && a[p] === b[p]) p++;
  let s = 0;
  while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return [p, s];
}

/** The previous version of `body` among the sentences shown last time, or null. */
function previousVersion(body, current) {
  // Same sentence as last time (e.g. only a space was typed after it).
  if (lastShown.has(body)) return { old: body, answers: lastShown.get(body), p: body.length, s: 0 };
  let best = null;
  for (const [old, answers] of lastShown) {
    if (current.has(old)) continue; // still in the text: it's another sentence
    const [p, s] = commonEnds(old, body);
    if ((p + s) * 2 < Math.max(old.length, body.length)) continue; // too different
    if (!best || p + s > best.p + best.s) best = { old, answers, p, s };
  }
  return best;
}

function moveSpans(list, { old, p, s }, body) {
  const delta = body.length - old.length;
  return list.flatMap((sp) => {
    if (sp.end < p) return [sp]; // before the edit
    if (sp.at > old.length - s) return [{ ...sp, at: sp.at + delta, end: sp.end + delta }]; // after it
    return []; // touches the edit
  });
}

/** Fill the missing answers of `body` from its previous version. */
function withPrevious(body, finished, answers, current) {
  const missing = answers.difficulty === undefined || answers.spans.some(([, list]) => list === undefined);
  if (!missing) return answers;
  const prev = previousVersion(body, current);
  if (!prev) return answers;
  return {
    // A reused score is only for display: `stale` keeps it out of feature 6.
    difficulty: answers.difficulty === undefined && finished && prev.answers.difficulty ? { ...prev.answers.difficulty, stale: true } : answers.difficulty,
    spans: answers.spans.map(([mark, list], i) => {
      const old = prev.answers.spans[i]?.[1];
      return [mark, list === undefined && old ? moveSpans(old, prev, body) : list];
    }),
  };
}

/** Trigger parts of a sentence body. */
function findTriggers(body, bodyStart) {
  return [...body.matchAll(TRIGGER_RE)].map((m) => {
    const word = m[0];
    const open = word.length === 1 || word.at(-1) !== TRIGGER_CLOSE[word[0]];
    return { at: m.index, text: word, mark: "trig", kind: TRIGGER_KIND[word[0]], open, start: bodyStart + m.index };
  });
}

/**
 * Marked spans of a sentence body, from the backend answers. Drops spans that
 * overlap a trigger or a more important span, or that end where the text ends (the
 * word is still being typed).
 */
function findSpans(bodyStart, textLength, spanAnswers, triggers) {
  const taken = triggers.map((t) => [t.at, t.at + t.text.length]);
  const spans = [];
  for (const [mark, list] of spanAnswers) {
    for (const { at, end, text, suggestion } of list ?? []) {
      if (bodyStart + end === textLength) continue;
      if (taken.some(([a, b]) => at < b && end > a)) continue;
      taken.push([at, end]);
      spans.push({ at, text, mark, start: bodyStart + at, fix: suggestion });
    }
  }
  return spans;
}

/**
 * Split the text into sentences and parts.
 * `get(key, fn)` returns the (cached) answer of `fn`, or undefined when not known yet.
 * With `reusePrevious`, a sentence without answers borrows those of its previous version.
 * See computeHighlights for the returned shape.
 */
function build(text, get, reusePrevious = false) {
  const chunks = [];
  const bodies = [...text.matchAll(SENTENCE_RE)].map((m) => m[0].trim());
  const current = new Set(bodies);
  const shown = new Map();
  for (const s of text.matchAll(SENTENCE_RE)) {
    const raw = s[0];
    // Keep surrounding whitespace out of the pink box.
    const lead = raw.match(/^\s*/)[0].length;
    const body = raw.trim();
    if (lead) chunks.push({ text: raw.slice(0, lead), hardSentence: false, parts: [{ text: raw.slice(0, lead), mark: null }] });
    if (!body) continue;

    const bodyStart = s.index + lead;
    const finished = /[.!?]$/.test(body);

    let answers = answersOf(body, finished, get);
    if (reusePrevious) answers = withPrevious(body, finished, answers, current);
    shown.set(body, answers);
    const difficulty = answers.difficulty ?? null;

    const triggers = findTriggers(body, bodyStart);
    const spans = findSpans(bodyStart, text.length, answers.spans, triggers);

    const parts = [];
    let last = 0;
    for (const { at, ...part } of [...triggers, ...spans].sort((a, b) => a.at - b.at)) {
      if (at > last) parts.push({ text: body.slice(last, at), mark: null });
      parts.push(part);
      last = at + part.text.length;
    }
    if (last < body.length) parts.push({ text: body.slice(last), mark: null });
    chunks.push({ text: body, start: bodyStart, hardSentence: !!difficulty?.hard, difficulty, parts });

    const trail = raw.slice(lead + body.length);
    if (trail) chunks.push({ text: trail, hardSentence: false, parts: [{ text: trail, mark: null }] });
  }
  if (reusePrevious) lastShown = shown;
  return chunks;
}

/**
 * Highlights from cached answers only — synchronous, never waits. Used to render the
 * current text while computeHighlights is still running (triggers are always there).
 * A sentence being edited keeps the marks of its previous version until it is answered.
 */
export function highlightsNow(text) {
  return build(text, (key) => cache.get(key), true);
}

/**
 * Split the text into sentences with their highlights, asking the backend about every
 * sentence not cached yet.
 * Resolves to [{ text, start, hardSentence, difficulty, parts }] where
 *   - `difficulty` = { score: 0..100, hard } for scored sentences, else null;
 *   - parts = [{ text, mark: 'err' | 'hard' | 'better' | 'trig' | null }].
 * Marked parts also carry `start` (offset in the text) and `fix` (the suggested replacement).
 * Trigger parts carry `start`, `kind` ('desc' | 'lang' | 'idiom') and `open` (closing
 * bracket/quote not typed yet).
 * Joining every part's text gives back the original text exactly (the mirror relies on it).
 */
export async function computeHighlights(text) {
  const pending = [];
  build(text, (key, fn) => ask(key, fn, pending));
  await Promise.all(pending);
  return highlightsNow(text);
}

/**
 * Feature 5 gauge: average sentence score, weighted by sentence length.
 * Returns { score: 0..100, hardest: n } (n = 1-based sentence number), or null when
 * no sentence is scored yet.
 */
export function overallDifficulty(chunks) {
  const sentences = chunks.filter((c) => c.start !== undefined);
  let total = 0;
  let weight = 0;
  let hardest = null;
  sentences.forEach((c, i) => {
    if (!c.difficulty) return;
    total += c.difficulty.score * c.text.length;
    weight += c.text.length;
    if (!hardest || c.difficulty.score > hardest.score) hardest = { score: c.difficulty.score, n: i + 1 };
  });
  return weight ? { score: Math.round(total / weight), hardest: hardest.n } : null;
}

/**
 * Quick fixes = every red / yellow / blue span, in text order (pink sentences are
 * handled by the "Simpler version" note). Returns [{ start, from, to, mark }].
 */
export function listFixes(chunks) {
  return chunks
    .flatMap((c) => c.parts)
    .filter((p) => p.mark && p.mark !== "trig" && p.fix && p.fix !== p.text)
    .map((p) => ({ start: p.start, from: p.text, to: p.fix, mark: p.mark }));
}

/**
 * Feature 6: pink sentences for the "Simpler version" note, in text order, minus the
 * ones in `skip` (sentence texts the user kept or already swapped).
 * Resolves to [{ start, from, to }].
 */
export async function listHardSentences(chunks, skip = new Set()) {
  // `stale` = sentence being edited, still showing its old score: don't simplify every keystroke.
  const hard = chunks.filter((c) => c.hardSentence && !c.difficulty.stale && !skip.has(c.text));
  const list = await Promise.all(
    hard.map(async (c) => ({
      start: c.start,
      from: c.text,
      to: await cached(keyOf("simplify", c.text), () => api.simplify(c.text)),
    })),
  );
  return list.filter((s) => s.to && s.to !== s.from);
}

/** Apply fixes to the text (from the end, so earlier offsets stay valid). */
export function applyFixes(text, fixes) {
  return [...fixes]
    .sort((a, b) => b.start - a.start)
    .reduce((t, f) => (t.slice(f.start, f.start + f.from.length) === f.from ? t.slice(0, f.start) + f.to + t.slice(f.start + f.from.length) : t), text);
}
