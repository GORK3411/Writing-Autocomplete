"""Feature 2: word in another language (French / Arabic -> English).

I feel [fatigué]  ->  I feel tired

Planned: multilingual embeddings (LaBSE) + MUSE bilingual dictionaries, same in-context
reranking as feature 1 (reuse the shared search engine and masked LM).
"""

from app.schemas import Candidate

# DUMMY data until the multilingual search is ready.
_DEMO = {
    "fatigué": [("tired", 0.95), ("exhausted", 0.81), ("weary", 0.64)],
}


def translate_word(query: str, sentence: str) -> list[Candidate]:
    """English words for the foreign word `query`, best first.

    `sentence` is the whole sentence (with the [...] still inside), for reranking.
    """
    found = _DEMO.get(query.strip().lower(), [("NLP", 0.5)])
    return [Candidate(text=t, score=s) for t, s in found]
