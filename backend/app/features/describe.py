"""Feature 1. Look up a description and propose a word with a contextual edit."""

from app.schemas import Candidate
from app.search import search, word_candidate


def describe_to_words(query: str, sentence: str, trigger_start: int | None = None) -> list[Candidate]:
    return [word_candidate(word, score, query, sentence, trigger_start)
            for word, score in search(query, sentence, "word")]
