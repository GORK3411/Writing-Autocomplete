# Finish Smart Writing

## Implementation checklist

- [x] Preserve eight API routes and add precise contextual edits. Validate original slices and sentence snapshots, handle insertions and deletions, and support grouped undo.
- [x] Implement WordNet description search, MUSE French and Arabic lookup, and idiom retrieval using TF-IDF and MiniLM.
- [x] Implement Flesch readability, conservative plain-word suggestions, and stronger-word suggestions.
- [x] Implement on-demand simplification and delayed grammar inference with local T5 checkpoints. Remove all placeholder outputs.
- [x] Prepare offline browser and backend assets, Windows launch scripts, and a same-origin build.
- [x] Verify all nine features in a fresh local Chrome context with external requests blocked.

## Study guide for five presenters

| Presenter | Explain | Worked example |
| --- | --- | --- |
| 1. Word search | TF-IDF identifies definitions that contain useful query terms. MiniLM compares meanings in a shortlist. The contextual edit can replace an existing article or insert one. | A description of someone who writes books gives **an author** in the sentence **I am an author**. |
| 2. Translation and idioms | Normalize input for dictionary lookup. Compare context with candidate glosses when a word is ambiguous. Idioms reuse the definition search. | French **fatigué** gives **tired**, Arabic **كتاب** gives **book**, and an easy task can be **a piece of cake**. |
| 3. Autocomplete and readability | A lookup table counts next words from one- and two-word contexts. The browser then runs DistilGPT-2. The gauge inverts and clamps Flesch Reading Ease and weights each sentence by length. | Type **The results show that the** and a space. Compare **The dog ran home.** with a dense academic sentence. |
| 4. Word suggestions and simplification | Frequency helps identify uncommon words. The plain-words list and WordNet senses constrain replacements. A small T5 model proposes a rewrite on demand. Readability, length, semantic similarity, numbers, and negation are checked before display. | Compare **utilize → use** and **very big → huge**. Preview a rewrite of the committee sentence from the README. |
| 5. Grammar and editing | SymSpell uses edit distance and frequency for spelling. T5 rewrites a sentence, and a token diff recovers insertions, deletions, and substitutions as precise spans. | Apply and undo a correction for **I has a apple**. Show how an emoji at the start changes JavaScript offsets. |

These methods replace the planned DistilRoBERTa readability regressor, LaBSE translation search, and BERT masked word replacement. The backend models run on CPU with two inference threads. Chrome can use a single WASM thread for autocomplete when cross-origin isolation is unavailable. The editor can keep accepting text while sentence checks run. There is no model fine-tuning in this implementation.

## Assets and reproducibility

The downloader uses pinned revisions and validates the size and SHA-256 of all 23 model files, including configuration and tokenizer files. The Windows launcher checks them again before serving the editor. Dictionary hashes are pinned. Model files, downloaded datasets, the generated n-gram table, and build output are ignored. The catalog contains 213 original short glosses with Wiktionary references. Sources are listed here so a presenter can explain where the training data and rules came from.

- Definitions use [Princeton WordNet](https://wordnet.princeton.edu/). Bilingual dictionaries come from [MUSE](https://github.com/facebookresearch/MUSE#ground-truth-bilingual-dictionaries).
- Neural retrieval uses [MiniLM ONNX](https://huggingface.co/Qdrant/all-MiniLM-L6-v2-onnx). The browser uses [DistilGPT-2](https://huggingface.co/Xenova/distilgpt2) and a table generated from [WikiText-103](https://huggingface.co/datasets/Salesforce/wikitext).
- Word frequency comes from [wordfreq](https://pypi.org/project/wordfreq/). Readability uses [textstat](https://github.com/textstat/textstat). Spelling uses [SymSpellPy](https://github.com/mammothb/symspellpy).
- Rewriting checkpoints are [FLAN-T5 small simplifier](https://huggingface.co/agentlans/flan-t5-small-simplifier) and [Proximity grammar T5-small](https://huggingface.co/selfnify/proximity). Fonts come from the Caveat and Patrick Hand Fontsource distributions.

## Verification record

Use the backend and browser commands in the README. The fixed quality cases are in backend/tests/quality_cases.json. Ratings for these small teaching fixtures describe this snapshot and task mix. Grammar and simplification can miss errors or change nuance. Preview generated text before accepting it.

### Windows evaluation

- Windows setup completed with cached assets and a clean npm install. It verified the model files and rebuilt Vite. The build warns about the size of the lazily loaded WebAssembly runtime.
- Sixteen Python tests and six JavaScript tests passed. Coverage.py reported 89% combined statement and branch coverage for the backend app with the model evaluation included. Node reported 93.33% line and 91.45% branch coverage across four editor helper modules. The React components are exercised separately in Chrome.
- Both dependency audits reported zero known vulnerabilities in the tested Python environment and npm lockfile. The backend checks the API origin, host, content type, request size, and input offsets. The model manifest rejects files whose contents differ even when their size matches.
- The real WikiText-103 build produced 30,000 vocabulary entries and 158,460 contexts in a 3.7 MB table. The builder took 83 seconds after corpus preparation.
- Fixed retrieval examples produced a correct top-three result or abstained correctly in all 17 cases. Description lookup got 5 of 5, translation got 7 of 7, and idioms got 5 of 5. All three unsupported queries returned no candidates. The surgeon description improved from a miss to second place after indexing parent terms and widening the shortlist. For the classroom example about someone who writes books, WordNet's entry for **bookmaker** can rank above **author**, which remains available. The context test ranked **book** and **pound** first for their respective uses of **livre**.
- Eight concurrent cold dictionary requests passed after synchronizing WordNet reads. The first description lookup builds the index in memory and can take tens of seconds. The result is reused for the rest of the session.
- Grammar matched 8 of 8 expected results and changed none of the four clean inputs. The first grammar request took 12.12 seconds in the coverage run. Later requests took 0.14–0.95 seconds. In a separate browser fixture with two errors, the model removed the repeated article but left a missing preposition. The single-error examples corrected both edit types.
- Simplification took 0.40–1.24 seconds across four examples in the coverage run. A manual read found three rewrites that preserved the core meaning while retaining some complex wording. The model dropped the act of organizing in the librarian sentence, so the preservation check retained the original.
- Warm p95 over 35 in-process API calls per route was 8.5 ms for readability, 9.7 ms for hard words, 7.9 ms for better words, and 7.0 ms for spelling. These timings exclude debounce, HTTP transport, and rendering.

### Browser rehearsal

The Windows launch script served the production app on 127.0.0.1:8000 after passing readiness checks. A second launcher reported the occupied port. The Vite development proxy also passed a local API request.

A fresh Chrome context blocked all external browser requests and exercised all nine features with local data and models. It verified exact draft and mirror text, draft persistence, cheat-sheet focus, keyboard lookup, mouse lookup, unavailable lookup and retry, and edit and undo flows. Real grammar examples covered substitutions, insertions, and deletions. The browser accepted DistilGPT-2 grey text with Tab. A separate context blocked the model files and accepted an n-gram completion with Tab. Lookups passed at desktop, 1280 × 720 projector, and 390 px narrow sizes.

A separate warm HTTP smoke test recorded p95 of 16.7 ms for readability, 17.0 ms for hard words, 17.2 ms for better words, and 16.7 ms for spelling across 35 requests per route. All four were within the 300 ms target. The browser rehearsal used request blocking for off-machine URLs while the backend enforced offline model loading.
