// Calls to the Python backend (backend/app/api.py). One function per endpoint.
//
// The classroom build serves these routes on the same origin. Vite proxies them in development.
const BASE = "/api";

// Longest sentence the backend accepts (backend/app/schemas.py MAX_SENTENCE).
export const MAX_SENTENCE = 2000;

async function post(path, body, timeout = 15_000) {
  const res = await fetch(BASE + path, {
    method: "POST",
    signal: AbortSignal.timeout(timeout),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// ---- features 1-3: resolve to [{ text, score }], best first ----
// The first description request builds the WordNet search index.
export const describe = (query, sentence, trigger_start) => post("/describe", { query, sentence, trigger_start }, 90_000).then((r) => r.candidates); // 1
export const translate = (query, sentence, trigger_start) => post("/translate", { query, sentence, trigger_start }).then((r) => r.candidates); // 2
export const idiom = (query, sentence, trigger_start) => post("/idiom", { query, sentence, trigger_start }).then((r) => r.candidates); // 3

// ---- feature 5: resolves to { score: 0..100, hard: bool } ----
export const difficulty = (sentence) => post("/difficulty", { sentence });

// ---- feature 6: resolves to the simpler sentence ----
export const simplify = (sentence) => post("/simplify", { sentence }, 45_000).then((r) => r.simplified);

// ---- features 7-9: resolve to [{ start, end, text, suggestion }] ----
// start / end are Python string indices (code points) into the sentence.
export const hardWords = (sentence) => post("/hard-words", { sentence }).then((r) => r.spans); // 7
export const betterWords = (sentence) => post("/better-words", { sentence }).then((r) => r.spans); // 8
export const grammar = (sentence, thorough = true) => post("/grammar", { sentence, thorough }, thorough ? 45_000 : 15_000).then((r) => r.spans); // 9
