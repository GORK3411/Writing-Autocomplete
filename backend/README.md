# Backend

Use the root Windows setup to prepare the Python 3.12 environment and local assets. For development, run the commands from this directory.

    .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
    .\.venv\Scripts\python.exe -m unittest discover -s tests
    .\.venv\Scripts\python.exe -m tests.evaluate_demo

The browser normally calls relative /api URLs. FastAPI serves the compiled frontend from frontend/dist when that directory exists. The development frontend uses the Vite proxy.

| Endpoint | Body | Result |
| --- | --- | --- |
| /api/describe | query, sentence, optional trigger_start | candidates |
| /api/translate | query, sentence, optional trigger_start | candidates |
| /api/idiom | query, sentence, optional trigger_start | candidates |
| /api/difficulty | sentence | score and hard |
| /api/simplify | sentence | simplified |
| /api/hard-words | sentence | spans |
| /api/better-words | sentence | spans |
| /api/grammar | sentence, optional thorough | spans |

All eight routes accept JSON POST requests up to 32 KiB. Use 127.0.0.1 or localhost. A model queue at capacity returns 503 with Retry-After. Validation responses omit submitted draft text. Candidates have text, a 0–1 match score, and an optional edit for contextual replacement. Edits and spans use zero-based Python string offsets into the supplied sentence. The end is exclusive, insertions have an empty source slice, and deletions have an empty suggestion. The browser converts indices to UTF-16. A grammar request with thorough=false runs the spelling pass only. Omit the field to include grammar.

GET /health confirms the process is responding. GET /ready checks that the classroom bundle and assets exist. API docs are available at /docs. Browser autocomplete has no Python endpoint.

The generated n-gram table uses the first 20 million words from the WikiText-103 training shard. You can run the existing builder on a small text file with python scripts/build_ngram.py --text-file corpus.txt --out table.json for an isolated experiment.

For the browser rehearsal, install playwright==1.56.0 into the venv, run the classroom server, then run python tests/rehearse_browser.py. The rehearsal uses installed Chrome and blocks non-local browser requests.

### Repeat the verification

- Run backend regression and real-model coverage with `python -m coverage run --branch --source=app -m unittest discover -s tests`, then `python -m coverage run --append --branch --source=app -m tests.evaluate_demo` and `python -m coverage report`.
- From the frontend directory, run `node --test --experimental-test-coverage tests/*.test.js` and `npm run build`.
- With the packaged server running, run the browser rehearsal above. This tests both autocomplete engines, model inference, edit and undo, persistence, keyboard help, recovery from an unavailable endpoint, and a narrow viewport.
- For dependency checks, run `python -m pip check`, `python -m pip_audit`, and `npm audit` in the appropriate environments. Coverage, pip-audit, and Playwright are verification tools.
