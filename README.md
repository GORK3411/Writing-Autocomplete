# Writing-Autocomplete

A writing assistant that helps you **while you type**: it finds the words you need and keeps your text easy to read.

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Python + FastAPI (`backend/`), where all the NLP models live

## How to run the project

You need **Python 3.11+** and **Node.js 18+**. Use two terminals: one for the backend, one for the frontend.

### 1. Backend (terminal 1)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs on http://127.0.0.1:8000. API docs (to try each endpoint): http://127.0.0.1:8000/docs

The first time only, build the next-word table used by the autocomplete (feature 4). It takes a few minutes:

```bash
python scripts/build_ngram.py   # writes frontend/public/ngram.json (generated, not committed)
```

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards every `/api/...` call to the backend on port 8000, so **start the backend first**. If the backend is not running, the editor still works, but without highlights or suggestions.

After the first time, you only need `uvicorn app.main:app --reload` (in `backend/` with the venv active) and `npm run dev` (in `frontend/`).

## Where to plug in each model

Each feature has one backend endpoint, already called by the frontend. All of them **return dummy values for now**. To connect a real model, **edit only the function in the last column**: the route and the frontend don't need to change.

| # | Feature | Endpoint | Backend function to edit | Input | Must return |
|---|---|---|---|---|---|
| 1 | Description to word | `POST /api/describe` | `describe_to_words` in [describe.py](backend/app/features/describe.py) | `query`, `sentence` | `list[Candidate]` (`text`, `score` 0–1), best first |
| 2 | Word in another language | `POST /api/translate` | `translate_word` in [translate.py](backend/app/features/translate.py) | `query`, `sentence` | `list[Candidate]`, best first |
| 3 | Idiom finder | `POST /api/idiom` | `find_idioms` in [idiom.py](backend/app/features/idiom.py) | `query`, `sentence` | `list[Candidate]`, best first |
| 4 | Next-word autocomplete | none (runs in the browser) | ✅ **DONE — MUST NOT BE TOUCHED** | — | — |
| 5 | Live difficulty score | `POST /api/difficulty` | `score_sentence` in [difficulty.py](backend/app/features/difficulty.py) | `sentence` | `DifficultyResponse` (`score` 0–100, `hard` = paint it pink) |
| 6 | Simplify this | `POST /api/simplify` | `simplify_sentence` in [simplify.py](backend/app/features/simplify.py) | `sentence` | `str`: the simpler sentence |
| 7 | Hard words (yellow) | `POST /api/hard-words` | `find_hard_words` in [hard_words.py](backend/app/features/hard_words.py) | `sentence` | `list[Span]` |
| 8 | Better words (blue) | `POST /api/better-words` | `find_better_words` in [better_words.py](backend/app/features/better_words.py) | `sentence` | `list[Span]` |
| 9 | Spelling & grammar (red) | `POST /api/grammar` | `find_errors` in [grammar.py](backend/app/features/grammar.py) | `sentence` | `list[Span]` |

> [!WARNING]
> **Feature 4 (next-word autocomplete) is done and MUST NOT BE TOUCHED.**
> Do not edit [llm.js](frontend/src/llm.js), [ngram.js](frontend/src/ngram.js), [build_ngram.py](backend/scripts/build_ngram.py), or the feature 4 section of [App.jsx](frontend/src/App.jsx).

**Notes:**

- **`Span`** = `start`, `end`, `text`, `suggestion`. The offsets are Python string indices, and `sentence[start:end]` must equal `text`. A span can cover several words, like `very big` → `huge`. If a span's offsets don't match its `text`, the frontend ignores it instead of highlighting the wrong word.
- **Features 1–3:** `sentence` is the whole sentence with the trigger (`"..."`, `[...]`, `{...}`) still in it, so the model can rerank candidates in context.
- **Feature 5:** to change when a sentence turns pink, edit `HARD_THRESHOLD` in the same file. The gauge is computed in the frontend as the average of the sentence scores, weighted by length.
- **Feature 9:** the planned T5 model rewrites the whole sentence. Compare the input and the output to get the spans.
- The data types are defined in [schemas.py](backend/app/schemas.py) and the routes in [api.py](backend/app/api.py). You only need to change those if a feature has to return a new field.
- The frontend calls every endpoint through [api.js](frontend/src/api.js) and caches the answers per sentence, so only new or edited sentences are sent to the backend.
- **Never commit datasets or model weights.** Put them on Google Drive / Hugging Face Hub and add a download script (see [CLAUDE.md](CLAUDE.md)).
