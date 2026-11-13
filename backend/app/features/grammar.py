"""Feature 9: spelling & grammar fixes (red squiggle).

I has a apple  ->  "has" -> "have", "a" -> "an"

Planned: grammatical error correction with T5 (JFLEG, BEA-2019). The model rewrites the
whole sentence; diff the input and the output to get the spans below.
"""

from app.features._placeholder import random_spans
from app.schemas import Span


def find_errors(sentence: str) -> list[Span]:
    """Spelling / grammar errors of the sentence, each with its correction."""
    return random_spans("error", sentence)  # DUMMY
