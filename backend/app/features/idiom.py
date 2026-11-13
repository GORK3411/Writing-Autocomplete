"""Feature 3: idiom finder.

{something very easy}  ->  a piece of cake

Planned: the same embedding search engine as feature 1, on Wiktionary idiom definitions.
"""

from app.schemas import Candidate

# DUMMY data until the idiom search is ready.
_DEMO = {
    "something very easy": [("a piece of cake", 0.93), ("a walk in the park", 0.86), ("child's play", 0.7)],
}


def find_idioms(query: str, sentence: str) -> list[Candidate]:
    """Idioms meaning `query`, best first.

    `sentence` is the whole sentence (with the {...} still inside), for reranking.
    """
    found = _DEMO.get(query.strip().lower(), [("NLP", 0.5)])
    return [Candidate(text=t, score=s) for t, s in found]
