"""Feature 3. Rank idiom definitions against the requested meaning."""

from app.schemas import Candidate
from app.search import search, trigger_match
from app.lexical import match_case


def find_idioms(query: str, sentence: str, trigger_start: int | None = None) -> list[Candidate]:
    match = trigger_match(query, sentence, trigger_start, "{")
    capital = match is not None and not sentence[:match.start()].strip()
    return [Candidate(text=match_case("Example", word) if capital else word, score=score)
            for word, score in search(query, sentence, "idiom")]
