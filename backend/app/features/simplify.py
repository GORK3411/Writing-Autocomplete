"""Feature 6. Offer local rewrites only when basic preservation checks pass."""

import re

from app.features.difficulty import reading_ease
from app.lexical import TRIGGERS, WORDS
from app.resources import embed, generate

NUMBER = re.compile(r"(?<!\w)[+\u2212-]?\d+(?:[.,]\d+)*%?")
NEGATION = re.compile(r"\b(?:not|no|never|neither|nor|without|cannot)\b|n['’]t\b", re.I)


def preserves_details(original, candidate):
    return (NUMBER.findall(original) == NUMBER.findall(candidate)
            and len(NEGATION.findall(original)) == len(NEGATION.findall(candidate)))


def simplify_sentence(sentence: str) -> str:
    if not sentence.strip() or TRIGGERS.search(sentence):
        return sentence
    candidate = generate("simplifier", sentence)
    # Large deletions are risky even when the remaining words are semantically close.
    if len(WORDS.findall(candidate)) < 0.7 * len(WORDS.findall(sentence)):
        return sentence
    if (candidate and candidate != sentence and preserves_details(sentence, candidate)
            and reading_ease(candidate) >= reading_ease(sentence) + 3):
        vectors = embed([sentence, candidate])
        if float(vectors[0] @ vectors[1]) >= 0.87:
            return candidate
    return sentence
