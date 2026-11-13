// Inline highlights painted behind the text (same colors everywhere in the UI):
//   yellow marker = hard word      (feature 7)  -> isHardWord
//   blue marker   = better word    (feature 8)  -> isBetterWord
//   pink          = hard sentence  (features 5/6) -> isHardSentence
//
// For now each check is a PLACEHOLDER that fires at random with a low probability.
// Replace the body of each function with the real model call later; the rest of
// the pipeline (splitting, rendering) does not need to change.

const PLACEHOLDER_PROBABILITY = 0.07;

/** Pink: is this (finished) sentence hard to read? */
export function isHardSentence(sentence) {
  return pseudoRandom("sentence:" + sentence) < PLACEHOLDER_PROBABILITY;
}

/** Yellow: is this word hard, i.e. does it have a simpler alternative? */
// `occurrence` = how many times this word appeared before (0 for the first one), so
// the random placeholder doesn't light up every copy of a common word like "the".
export function isHardWord(word, sentence, occurrence) {
  return pseudoRandom("hard:" + word.toLowerCase() + ":" + occurrence) < PLACEHOLDER_PROBABILITY;
}

/** Blue: could this word be replaced by a stronger / non-repeated one? */
export function isBetterWord(word, sentence, occurrence) {
  return pseudoRandom("better:" + word.toLowerCase() + ":" + occurrence) < PLACEHOLDER_PROBABILITY;
}

// Deterministic "random" number in [0, 1) from a string: the same word keeps the
// same highlight on every keystroke instead of flickering.
function pseudoRandom(key) {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // final mix so short keys still spread over the whole range
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

// Text inside "...", [...] or {...} (closed or still being typed) is about to be
// replaced by features 1-3, so it is never highlighted.
const TRIGGER_RE = /"[^"]*"?|\[[^\]]*\]?|\{[^}]*\}?/g;
// A sentence = anything up to and including its end punctuation.
const SENTENCE_RE = /[^.!?]+[.!?]*|[.!?]+/g;
const WORD_RE = /\p{L}[\p{L}\p{M}'’-]*/gu;

/**
 * Split the text into sentences and words with their highlight.
 * Returns [{ text, hardSentence, parts: [{ text, mark: 'hard' | 'better' | null }] }].
 * Joining every part's text gives back the original text exactly (the mirror relies on it).
 *
 * The word or sentence still being typed (at the very end) is not scored yet.
 */
export function computeHighlights(text) {
  const inTrigger = new Uint8Array(text.length);
  for (const m of text.matchAll(TRIGGER_RE)) inTrigger.fill(1, m.index, m.index + m[0].length);

  const seen = new Map(); // word -> times seen so far
  const chunks = [];
  for (const s of text.matchAll(SENTENCE_RE)) {
    const raw = s[0];
    const start = s.index;
    // Keep surrounding whitespace out of the pink box.
    const lead = raw.match(/^\s*/)[0].length;
    const body = raw.trim();
    if (lead) chunks.push({ text: raw.slice(0, lead), hardSentence: false, parts: [{ text: raw.slice(0, lead), mark: null }] });
    if (!body) continue;

    const bodyStart = start + lead;
    const finished = /[.!?]$/.test(body);
    const hardSentence = finished && isHardSentence(body);

    const parts = [];
    let last = 0;
    for (const w of body.matchAll(WORD_RE)) {
      const word = w[0];
      const end = bodyStart + w.index + word.length;
      const stillTyping = end === text.length;
      if (stillTyping || inTrigger[bodyStart + w.index]) continue;
      const key = word.toLowerCase();
      const occurrence = seen.get(key) ?? 0;
      seen.set(key, occurrence + 1);
      // Yellow wins over blue when both fire: a simpler word matters more.
      const mark = isHardWord(word, body, occurrence) ? "hard" : isBetterWord(word, body, occurrence) ? "better" : null;
      if (!mark) continue;
      if (w.index > last) parts.push({ text: body.slice(last, w.index), mark: null });
      parts.push({ text: word, mark });
      last = w.index + word.length;
    }
    if (last < body.length) parts.push({ text: body.slice(last), mark: null });
    chunks.push({ text: body, hardSentence, parts });

    const trail = raw.slice(lead + body.length);
    if (trail) chunks.push({ text: trail, hardSentence: false, parts: [{ text: trail, mark: null }] });
  }
  return chunks;
}
