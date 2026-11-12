# CLAUDE.md

## Project

**Smart Writing Autocomplete** (working name): a writing assistant that helps the user *while they type*. It finds the words they need and keeps their text easy to read.

- University NLP course project, team of 5.
- Product: a **web app or browser extension** (not decided yet).
- Backend and all NLP/ML code: **Python**.

## Design principles

- **Everything is inline.** Every feature works inside the text, without leaving the editor. No "submit and wait" features.
- **Speed matters.** Light features run continuously while typing (target < 300 ms). Heavy features (simplification, grammar correction) run after a typing pause or on click.
- Re-process only what changed (e.g. re-score only edited sentences), and cache results.
- Use pretrained models where possible, and fine-tune only when needed.

## Features

| # | Feature | Trigger | What happens |
|---|---|---|---|
| 1 | Description to word | Text between quotes `"..."` | `I am "a person who writes books"` → `I am an author`; fixes the grammar around it (a/an, plural, tense) |
| 2 | Word in another language | Word between square brackets `[...]` | `I feel [fatigué]` → `I feel tired` (French / Arabic → English) |
| 3 | Idiom finder | Meaning between curly brackets `{...}` | `{something very easy}` → `a piece of cake` |
| 4 | Next-word autocomplete | Automatic | Grey ghost text; Tab accepts |
| 5 | Live difficulty score | Always visible | Easy → Hard gauge; hardest sentences highlighted |
| 6 | "Simplify this" | Click a sentence highlighted as hard | Rewrites it in simpler words |
| 7 | Hard-word highlighting | Yellow underline | Simpler alternative (`utilize` → `use`) |
| 8 | Better-word suggestions | Blue underline | Stronger / non-repeated word (`very big` → `huge`) |
| 9 | Spelling & grammar fixes | Red underline | One-click correction |

Keep these triggers and colors consistent across the whole UI.

## Planned approach per feature

| Feature | Method | Data |
|---|---|---|
| 1 Description to word | Sentence embeddings searched against dictionary definitions → candidates reranked in context with a BERT masked LM → a/an + inflection fix (`lemminflect`) | WordNet (NLTK) |
| 2 Word in another language | Multilingual embeddings (LaBSE) + bilingual dictionaries, same in-context reranking as feature 1 | MUSE bilingual dictionaries |
| 3 Idiom finder | Same search engine as feature 1, on idiom definitions | Wiktionary idioms |
| 4 Next-word autocomplete | Small generative LM (GPT-2 / DistilGPT-2) | Pretrained |
| 5 Live difficulty score | Transformer regression (DistilRoBERTa), per sentence | CLEAR corpus (CommonLit) |
| 6 Simplify this | Text simplification (T5) | ASSET, WikiLarge |
| 7 Hard-word highlighting | Complex word identification + BERT masked LM for replacements | CWI 2018 shared task |
| 8 Better-word suggestions | BERT masked LM + repetition detection | Pretrained |
| 9 Spelling & grammar fixes | Grammatical error correction (T5) | JFLEG, BEA-2019 |

Features 1–3 share one embedding search engine, and features 1, 7 and 8 share the BERT masked LM. Build the shared parts as reusable modules instead of duplicating them per feature.

## Data & models

- **Never commit datasets or model weights** (`data/`, `models/`, `checkpoints/`, `*.pt`, `*.bin`, `*.safetensors`, `*.onnx` are gitignored).
- Store them on Google Drive / Hugging Face Hub and provide a download script in the repo.
- Small hand-made files (e.g. test sets of human-written descriptions) can be committed as gitignore exceptions.
- Never commit secrets: use `.env` (gitignored).

## Conventions

- Python for the backend and all NLP/ML code.
- When adding a feature, keep its trigger and UI behaviour as defined in the Features table above.
- Before loading a large model, check whether an already loaded shared model can be reused.
