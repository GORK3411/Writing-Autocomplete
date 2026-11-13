"""Helpers for the DUMMY answers. Delete this module once every feature has a real model."""

import hashlib
import re

from app.schemas import Span

PLACEHOLDER_PROBABILITY = 0.07

WORD_RE = re.compile(r"[^\W\d_][\w'’-]*")


def pseudo_random(key: str) -> float:
    """Deterministic "random" number in [0, 1): the same input always gets the same
    answer, so highlights don't flicker while the user types."""
    digest = hashlib.blake2b(key.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") / 2**64


def random_spans(feature: str, sentence: str, suggestion: str = "NLP") -> list[Span]:
    """Mark a few words of the sentence at random."""
    spans = []
    seen: dict[str, int] = {}
    for m in WORD_RE.finditer(sentence):
        word = m.group()
        occurrence = seen.get(word.lower(), 0)
        seen[word.lower()] = occurrence + 1
        if pseudo_random(f"{feature}:{word.lower()}:{occurrence}") < PLACEHOLDER_PROBABILITY:
            spans.append(Span(start=m.start(), end=m.end(), text=word, suggestion=suggestion))
    return spans
