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

## Build the next-word table (feature 4)

The ghost-text autocomplete uses an n-gram table built from WikiText-103.
It's generated (not committed), so build it once after cloning:

```bash
python scripts/build_ngram.py   # writes frontend/public/ngram.json (~5 MB, a few minutes)
```

`python scripts/build_ngram.py --help` lists the options (corpus size, vocabulary, your own text files).
