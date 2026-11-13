// src/ngram.js — instant next-word suggestions from a precomputed n-gram table.
// The table is built by backend/scripts/build_ngram.py and served from public/ngram.json.
// Tokenisation rules here must stay in sync with that script.

const START = "<s>";
const TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)*|[0-9]+|[.!?;:()"[\]\n]/g;
const SENTENCE_END = /^[.!?\n]$/;
const IS_WORD = /^[A-Za-z]/;
const CONTEXT_CHARS = 200; // only the end of the text matters for a 2-word context

let tablePromise = null;

/** Load ngram.json once; later calls return the same promise. */
export function loadNgram() {
  if (!tablePromise) {
    tablePromise = fetch(import.meta.env.BASE_URL + "ngram.json")
      .then((r) => {
        if (!r.ok) throw new Error(`ngram.json: HTTP ${r.status} (run backend/scripts/build_ngram.py)`);
        return r.json();
      })
      .then(({ vocab, next }) => {
        const lower = vocab.map((w) => w.toLowerCase());
        return { vocab, lower, next, index: new Map(lower.map((w, i) => [w, i])) };
      })
      .catch((err) => {
        tablePromise = null; // allow retry
        throw err;
      });
  }
  return tablePromise;
}

/** The (up to) 2 lowercase words before the cursor, "<s>" for a sentence start. */
function contextOf(table, before) {
  const tail = before.slice(-CONTEXT_CHARS);
  const toks = tail.match(TOKEN_RE) ?? [];
  const ctx = [];
  let i = toks.length - 1;
  for (; i >= 0 && ctx.length < 2; i--) {
    const t = toks[i];
    if (IS_WORD.test(t)) {
      const w = t.toLowerCase();
      if (!table.index.has(w)) return ctx; // unknown word: the context stops here
      ctx.unshift(w);
    } else {
      if (SENTENCE_END.test(t)) ctx.unshift(START);
      return ctx; // number, bracket, quote... also stops the context
    }
  }
  // Ran out of tokens: this is the start of the text (unless we only saw a slice of it).
  if (i < 0 && ctx.length < 2 && before.length <= CONTEXT_CHARS) ctx.unshift(START);
  return ctx;
}

/** Vocab indices predicted after this context: 2-word context first, then 1-word back-off. */
function candidates(table, ctx) {
  const out = [];
  if (ctx.length === 2) out.push(...(table.next[ctx.join(" ")] ?? []));
  if (ctx.length >= 1) out.push(...(table.next[ctx.at(-1)] ?? []));
  return out;
}

/**
 * The text to show as ghost text after `text` ("" for none):
 * - after a space: the most likely next word        "I am going to " -> "be"
 * - in the middle of a word: the rest of that word   "the Uni"        -> "ted"
 */
export function suggestNgram(table, text) {
  text = text.replace(/’/g, "'");
  const partial = text.match(/[A-Za-z']*$/)[0];
  const before = text.slice(0, text.length - partial.length);
  if (!partial && !/\s$/.test(text)) return ""; // e.g. right after "," or "." with no space yet

  const ctx = contextOf(table, before);
  const cands = candidates(table, ctx);

  if (!partial) {
    if (!cands.length) return "";
    const word = table.vocab[cands[0]];
    const sentenceStart = ctx.length === 1 && ctx[0] === START;
    return sentenceStart ? word[0].toUpperCase() + word.slice(1) : word;
  }

  // Complete the word being typed: prefer words predicted by the context,
  // otherwise the most frequent vocabulary word with that prefix.
  const p = partial.toLowerCase();
  const fits = (i) => table.lower[i].length > p.length && table.lower[i].startsWith(p);
  let best = cands.find(fits);
  if (best === undefined && p.length >= 2) {
    best = table.lower.findIndex((w, i) => fits(i));
    if (best < 0) return "";
  }
  return best === undefined ? "" : table.vocab[best].slice(p.length);
}
