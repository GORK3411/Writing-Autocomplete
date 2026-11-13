"""Feature 8: better-word suggestions (blue).

very big  ->  huge   (a span can cover several words)

Planned: the shared BERT masked LM + repetition detection.
"""

from app.features._placeholder import random_spans
from app.schemas import Span


def find_better_words(sentence: str) -> list[Span]:
    """Weak or repeated words of the sentence, each with a stronger replacement."""
    return random_spans("better", sentence)  # DUMMY
