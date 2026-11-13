"""Feature 5: live difficulty score, per sentence.

The frontend averages the sentence scores (weighted by length) for the Easy -> Hard
gauge, and paints the sentences with `hard=True` in pink.

Planned: DistilRoBERTa regression trained on the CLEAR corpus (CommonLit).
"""

from app.features._placeholder import pseudo_random
from app.schemas import DifficultyResponse

# Sentences scoring at least this much are highlighted in pink.
HARD_THRESHOLD = 90


def score_sentence(sentence: str) -> DifficultyResponse:
    """Difficulty of one finished sentence: score 0 (easy) .. 100 (hard)."""
    score = round(pseudo_random("difficulty:" + sentence) * 100, 1)  # DUMMY
    return DifficultyResponse(score=score, hard=score >= HARD_THRESHOLD)
