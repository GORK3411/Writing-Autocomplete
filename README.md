# Smart Writing

A local writing assistant for the NLP course. Type in the notebook, look up words as you write, and review changes before applying them.

## Start on Windows

1. Install 64-bit Python 3.12 and Node.js 22 or newer.
2. Double-click **Setup Smart Writing.cmd** while online. The first setup installs dependencies, downloads pinned models and dictionaries, builds the WikiText n-gram table, and compiles the editor. Leave the window open until it reports success.
3. Double-click **Start Smart Writing.cmd**. The editor opens at [localhost:8000](http://127.0.0.1:8000/). Leave the launcher running until you finish. The editor, fonts, models, and runtime assets are served from this machine.

The browser saves your draft on this origin. Model inference runs locally. Use the same browser and address to recover the same draft. Setup and browser verification were performed with Chrome on Windows.

## Rehearse the features

| Try this | What to do |
| --- | --- |
| I am "a person who writes books". | Click inside the quotes or press **Alt+Enter** with the caret inside them. Choose **an author**. |
| I feel [fatigué]. I read a [كتاب]. | Look up the French and Arabic words. Review the English options. |
| The exam was {something very easy}. | Choose **a piece of cake**. |
| The results show that the | Type a trailing space. Press **Tab** when grey text appears at the end. |
| We will utilize a very big box. | Review yellow and blue highlights. Apply both fixes in the sidebar, then use **Undo last edit**. |
| The committee utilized complicated terminology to describe the implementation process. | Check the readability gauge. Select **Simplify sentence** and review a rewrite if one passes the checks. |
| I has a apple | Select **Check draft** to include this sentence even without a period. Review the red fixes before applying them. |

The 0–100 gauge is a Flesch-based estimate. Translation and retrieval coverage depend on the dictionaries. Generated corrections and simpler versions need a meaning check.

## Troubleshoot

- If the launcher lists missing files, rerun setup. Verified files are reused. A first setup can take several minutes depending on download speed.
- If port 8000 is busy, close the earlier local server. Run the launcher again.
- Check [readiness](http://127.0.0.1:8000/ready) and the launcher output when a feature is unavailable. Use **Check draft** to retry analysis.
- The first description lookup builds the WordNet search index and may take tens of seconds. Open the author example before presenting and leave the launcher running for the demo.
- Blank lookup results mean that none of the retrieved words passed the match threshold. Rephrase the description or supply context to distinguish dictionary senses.

## Local protections

The launcher binds to loopback. The API accepts only loopback hostnames and known local browser origins, requires JSON for analysis, and caps request bodies. A strict browser policy keeps the packaged editor's script, font, and model requests local. Model files are checked against the pinned manifest before use. The draft is saved by this browser's local storage. Clear the site data on a shared computer when you finish.

## Develop and inspect

Run the backend from backend/ using its venv with python -m uvicorn app.main:app --reload. Run npm run dev from frontend/. Vite proxies API requests to 127.0.0.1:8000. The [API guide](backend/README.md) lists the endpoints and validation commands.

See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) for the implementation checklist, methods, sources, and classroom validation results. [CLAUDE.md](CLAUDE.md) records the original design.
