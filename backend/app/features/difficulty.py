"""Feature 5. Convert Flesch Reading Ease to a difficulty estimate."""

import re

import textstat

from app.lexical import outside_triggers
from app.schemas import DifficultyResponse

HARD_THRESHOLD = 65


def reading_ease(text):
    return textstat.flesch_reading_ease(text) if re.search(r"[a-z]", text, re.I) else 100


def score_sentence(sentence: str) -> DifficultyResponse:
    ease = reading_ease(outside_triggers(sentence))
    score = max(0, min(100, round(100 - ease)))
    return DifficultyResponse(score=score, hard=score >= HARD_THRESHOLD)
