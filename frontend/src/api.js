// Calls to the Python backend (backend/app/api.py). One function per endpoint.
//
// In dev, Vite forwards /api to http://localhost:8000 (vite.config.js). To call a
// backend somewhere else (e.g. from a browser extension), set VITE_API_URL in
// frontend/.env, e.g. VITE_API_URL=http://localhost:8000

const BASE = (import.meta.env?.VITE_API_URL ?? "") + "/api";

// Longest sentence the backend accepts (backend/app/schemas.py MAX_SENTENCE).
export const MAX_SENTENCE = 2000;

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// ---- features 1-3: resolve to [{ text, score }], best first ----
export const describe = (query, sentence) => post("/describe", { query, sentence }).then((r) => r.candidates); // 1
export const translate = (query, sentence) => post("/translate", { query, sentence }).then((r) => r.candidates); // 2
export const idiom = (query, sentence) => post("/idiom", { query, sentence }).then((r) => r.candidates); // 3

// ---- feature 5: resolves to { score: 0..100, hard: bool } ----
export const difficulty = (sentence) => post("/difficulty", { sentence });

// ---- feature 6: resolves to the simpler sentence ----
export const simplify = (sentence) => post("/simplify", { sentence }).then((r) => r.simplified);

// ---- features 7-9: resolve to [{ start, end, text, suggestion }] ----
// start / end are Python string indices (code points) into the sentence.
export const hardWords = (sentence) => post("/hard-words", { sentence }).then((r) => r.spans); // 7
export const betterWords = (sentence) => post("/better-words", { sentence }).then((r) => r.spans); // 8
export const grammar = (sentence) => post("/grammar", { sentence }).then((r) => r.spans); // 9
