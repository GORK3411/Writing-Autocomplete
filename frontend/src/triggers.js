// Features 1-3: clicking a "...", [...] or {...} box offers words to replace it with.
//   "desc"  = "a person who writes books" -> author        (feature 1)
//   "lang"  = [fatigué]                   -> tired         (feature 2)
//   "idiom" = {something very easy}       -> a piece of cake (feature 3)
//
// PLACEHOLDER: a tiny hard-coded table until the backend's embedding search is ready.
// Replace the body of suggestForTrigger with a fetch to the backend; it is already
// async, so the popup (loading state, picking) does not need to change.

const DEMO = {
  desc: {
    "a person who writes books": [["author", 0.92], ["writer", 0.88], ["novelist", 0.71]],
  },
  lang: {
    "fatigué": [["tired", 0.95], ["exhausted", 0.81], ["weary", 0.64]],
  },
  idiom: {
    "something very easy": [["a piece of cake", 0.93], ["a walk in the park", 0.86], ["child's play", 0.7]],
  },
};

/** Popup title per trigger kind. */
export const TRIGGER_TITLE = {
  desc: "A word for this",
  lang: "In English",
  idiom: "An idiom for this",
};

/**
 * Candidates for the text inside a trigger, best first.
 * `query` = text between the quotes/brackets, `sentence` = the whole sentence (context
 * for the masked-LM reranking). Resolves to [[word, score 0..1], ...].
 */
export async function suggestForTrigger(kind, query, sentence) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DEMO[kind]?.[q] ?? [["NLP", 0.5]];
}

/** Text between the opening and (optional) closing quote/bracket. */
export function triggerQuery(part) {
  return part.text.slice(1, part.open ? undefined : -1);
}

/** The trigger part (from computeHighlights) that contains offset `pos`, if any. */
export function triggerAt(chunks, pos) {
  for (const c of chunks) {
    for (const p of c.parts) {
      // Inclusive end: clicking right after the closing bracket still counts.
      if (p.mark === "trig" && pos >= p.start && pos <= p.start + p.text.length) {
        return { ...p, sentence: c.text };
      }
    }
  }
  return null;
}
