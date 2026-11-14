"""Feature 8. Suggest stronger phrases and alternatives for repeated words."""

import re

from app.lexical import STOP, WORDS, better_synonym, content, outside_triggers, word_span
from app.schemas import Span

STRONGER = {
    "very big": "huge", "very small": "tiny", "very tired": "exhausted",
    "very cold": "freezing", "very hot": "scorching", "very angry": "furious",
    "very afraid": "terrified", "very hungry": "famished", "very clean": "spotless",
    "very dirty": "filthy", "very happy": "delighted", "very quiet": "silent",
    "very loud": "deafening", "very old": "ancient", "very wet": "soaked",
}
PHRASE = re.compile(r"\b(?:" + "|".join(STRONGER) + r")\b", re.I)


def find_better_words(sentence: str) -> list[Span]:
    text = outside_triggers(sentence)
    spans = [word_span(match, STRONGER[match.group().lower()]) for match in PHRASE.finditer(text)]
    context, seen = content(text), set()
    for match in WORDS.finditer(text):
        word = match.group().casefold()
        if len(word) < 4 or not word.isascii() or word in STOP:
            continue
        repeated = word in seen
        seen.add(word)
        if not repeated or not match.group().islower():
            continue
        if any(match.start() < span.end and span.start < match.end() for span in spans):
            continue
        replacement = better_synonym(word, context - {word})
        if replacement:
            spans.append(word_span(match, replacement))
    return sorted(spans, key=lambda span: span.start)
