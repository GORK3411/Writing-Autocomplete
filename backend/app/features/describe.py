"""Feature 1: description to word.

I am "a person who writes books"  ->  I am an author

Planned: sentence embeddings searched against WordNet definitions, candidates reranked
in context with the shared BERT masked LM, then a/an + inflection fix (lemminflect).
"""

from app.schemas import Candidate

# DUMMY data until the embedding search is ready.
_DEMO = {
    "a person who writes books": [("author", 0.92), ("writer", 0.88), ("novelist", 0.71)],
}


def describe_to_words(query: str, sentence: str) -> list[Candidate]:
    """Words matching the description `query`, best first.

    `sentence` is the whole sentence (with the "..." still inside), for reranking.
    """
    found = _DEMO.get(query.strip().lower(), [("NLP", 0.5)])
    return [Candidate(text=t, score=s) for t, s in found]
