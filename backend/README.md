# Backend

FastAPI server for the NLP features.

## Setup

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

- Health check: http://127.0.0.1:8000/health
- Interactive API docs: http://127.0.0.1:8000/docs

The frontend dev server forwards `/api` to port 8000, so start both.

## Endpoints

All are `POST`, JSON in and out. Routes are in `app/api.py`, shapes in `app/schemas.py`.
To connect a model, edit **only the function in `app/features/`**; everything currently
returns dummy values.

| # | Endpoint | Body | Returns | Edit |
|---|---|---|---|---|
| 1 | `/api/describe` | `{query, sentence}` | `{candidates: [{text, score}]}` | `features/describe.py` → `describe_to_words` |
| 2 | `/api/translate` | `{query, sentence}` | `{candidates: [{text, score}]}` | `features/translate.py` → `translate_word` |
| 3 | `/api/idiom` | `{query, sentence}` | `{candidates: [{text, score}]}` | `features/idiom.py` → `find_idioms` |
| 5 | `/api/difficulty` | `{sentence}` | `{score: 0-100, hard}` | `features/difficulty.py` → `score_sentence` |
| 6 | `/api/simplify` | `{sentence}` | `{simplified}` | `features/simplify.py` → `simplify_sentence` |
| 7 | `/api/hard-words` | `{sentence}` | `{spans: [{start, end, text, suggestion}]}` | `features/hard_words.py` → `find_hard_words` |
| 8 | `/api/better-words` | `{sentence}` | `{spans: [...]}` | `features/better_words.py` → `find_better_words` |
| 9 | `/api/grammar` | `{sentence}` | `{spans: [...]}` | `features/grammar.py` → `find_errors` |

Feature 4 (autocomplete) runs in the browser and has no endpoint.
Span offsets are Python string indices into the sentence: `sentence[start:end] == text`.

## Build the next-word table (feature 4)

The ghost-text autocomplete uses an n-gram table built from WikiText-103.
It's generated (not committed), so build it once after cloning:

```bash
python scripts/build_ngram.py   # writes frontend/public/ngram.json (~5 MB, a few minutes)
```

`python scripts/build_ngram.py --help` lists the options (corpus size, vocabulary, your own text files).
