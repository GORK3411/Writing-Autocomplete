"""Feature 7: hard-word highlighting (yellow).

utilize  ->  use

Planned: complex word identification (CWI 2018) + the shared BERT masked LM for the
simpler replacement.
"""

from app.features._placeholder import random_spans
from app.schemas import Span


def find_hard_words(sentence: str) -> list[Span]:
    """Hard words of the sentence, each with a simpler replacement."""
    return random_spans("hard", sentence)  # DUMMY
