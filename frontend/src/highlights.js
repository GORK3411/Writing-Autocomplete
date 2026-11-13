// Inline highlights painted behind the text (same colors everywhere in the UI):
//   yellow marker = hard word      (feature 7)  -> isHardWord
//   blue marker   = better word    (feature 8)  -> isBetterWord
//   pink          = hard sentence  (features 5/6) -> isHardSentence
//   red squiggle  = spelling & grammar (feature 9) -> isSpellingError
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

/** Red squiggle: is this word misspelled or grammatically wrong here? */
export function isSpellingError(word, sentence, occurrence) {
  return pseudoRandom("error:" + word.toLowerCase() + ":" + occurrence) < PLACEHOLDER_PROBABILITY;
}

/**
 * Replacement offered in the Quick fixes note for a red / yellow / blue word.
 * `mark` is 'err' | 'hard' | 'better'. Placeholder: always "NLP".
 */
export function suggestFix(word, sentence, mark) {
  return "NLP";
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
// replaced by features 1-3: it gets the blue "find" box, never a word highlight.
const TRIGGER_SRC = String.raw`"[^"]*"?|\[[^\]]*\]?|\{[^}]*\}?`;
const TRIGGER_KIND = { '"': "desc", "[": "lang", "{": "idiom" }; // features 1, 2, 3
const TRIGGER_CLOSE = { '"': '"', "[": "]", "{": "}" };
// A sentence = anything up to and including its end punctuation. A trigger counts as
// one block, so a "." typed inside "..." doesn't end the sentence.
const SENTENCE_RE = new RegExp(String.raw`(?:${TRIGGER_SRC}|[^.!?"\[{])+[.!?]*|[.!?]+`, "g");
// Inside a sentence: a trigger (group 1) or a word (group 2).
const TOKEN_RE = new RegExp(String.raw`(${TRIGGER_SRC})|(\p{L}[\p{L}\p{M}'’-]*)`, "gu");

/**
 * Split the text into sentences and words with their highlight.
 * Returns [{ text, hardSentence, parts: [{ text, mark: 'err' | 'hard' | 'better' | 'trig' | null }] }].
 * Marked words also carry `start` (offset in the text) and `fix` (the suggested replacement).
 * Trigger parts carry `start`, `kind` ('desc' | 'lang' | 'idiom') and `open` (closing
 * bracket/quote not typed yet).
 * Joining every part's text gives back the original text exactly (the mirror relies on it).
 *
 * The word or sentence still being typed (at the very end) is not scored yet.
 */
export function computeHighlights(text) {
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
    for (const w of body.matchAll(TOKEN_RE)) {
      const word = w[0];
      if (w[1]) {
        // Trigger: always boxed, even while still being typed.
        const open = word.length === 1 || word.at(-1) !== TRIGGER_CLOSE[word[0]];
        if (w.index > last) parts.push({ text: body.slice(last, w.index), mark: null });
        parts.push({ text: word, mark: "trig", kind: TRIGGER_KIND[word[0]], open, start: bodyStart + w.index });
        last = w.index + word.length;
        continue;
      }
      const end = bodyStart + w.index + word.length;
      const stillTyping = end === text.length;
      if (stillTyping) continue;
      const key = word.toLowerCase();
      const occurrence = seen.get(key) ?? 0;
      seen.set(key, occurrence + 1);
      // When several fire, the most important wins: an error, then a hard word, then a better word.
      const mark = isSpellingError(word, body, occurrence)
        ? "err"
        : isHardWord(word, body, occurrence)
          ? "hard"
          : isBetterWord(word, body, occurrence)
            ? "better"
            : null;
      if (!mark) continue;
      if (w.index > last) parts.push({ text: body.slice(last, w.index), mark: null });
      const start = bodyStart + w.index;
      parts.push({ text: word, mark, start, fix: suggestFix(word, body, mark) });
      last = w.index + word.length;
    }
    if (last < body.length) parts.push({ text: body.slice(last), mark: null });
    chunks.push({ text: body, hardSentence, parts });

    const trail = raw.slice(lead + body.length);
    if (trail) chunks.push({ text: trail, hardSentence: false, parts: [{ text: trail, mark: null }] });
  }
  return chunks;
}

/**
 * Quick fixes = every red / yellow / blue word, in text order (pink sentences are
 * handled by the "Simpler version" note). Returns [{ start, from, to, mark }].
 */
export function listFixes(chunks) {
  return chunks
    .flatMap((c) => c.parts)
    .filter((p) => p.mark && p.fix && p.fix !== p.text)
    .map((p) => ({ start: p.start, from: p.text, to: p.fix, mark: p.mark }));
}

/** Apply fixes to the text (from the end, so earlier offsets stay valid). */
export function applyFixes(text, fixes) {
  return [...fixes]
    .sort((a, b) => b.start - a.start)
    .reduce((t, f) => (t.slice(f.start, f.start + f.from.length) === f.from ? t.slice(0, f.start) + f.to + t.slice(f.start + f.from.length) : t), text);
}
