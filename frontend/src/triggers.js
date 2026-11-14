// Features 1-3: clicking a "...", [...] or {...} box offers words to replace it with.
//   "desc"  = "a person who writes books" -> author        (feature 1)
//   "lang"  = [fatigué]                   -> tired         (feature 2)
//   "idiom" = {something very easy}       -> a piece of cake (feature 3)
//
// The candidates come from the backend (backend/app/features/describe.py, translate.py,
// idiom.py). The popup (loading state, picking) does not need to change.

import { codePointOffsets } from "./edits.js";
import * as api from "./api.js";

const ENDPOINT = { desc: api.describe, lang: api.translate, idiom: api.idiom };

/** Popup title per trigger kind. */
export const TRIGGER_TITLE = {
  desc: "A word for this",
  lang: "In English",
  idiom: "An idiom for this",
};

/**
 * Candidates for the text inside a trigger, best first.
 * `query` = text between the quotes/brackets, `sentence` = the whole sentence (context
 * for contextual ranking). The offset is converted before the request.
 */
export async function suggestForTrigger(kind, query, sentence, triggerStart) {
  if (!query.trim() || !Object.hasOwn(ENDPOINT, kind)) return [];
  const offset = codePointOffsets(sentence).indexOf(triggerStart);
  return ENDPOINT[kind](query, sentence, offset < 0 ? undefined : offset);
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
        return { ...p, sentence: c.text, sentenceStart: c.start };
      }
    }
  }
  return null;
}
