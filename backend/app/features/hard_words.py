"""Feature 7. Prefer safe plain equivalents, then frequent same-sense synonyms."""

from wordfreq import zipf_frequency
from app.lexical import PLAIN, STOP, WORDS, base_form, better_synonym, content, inflect_like, outside_triggers, word_span
from app.schemas import Span


def find_hard_words(sentence: str) -> list[Span]:
    text = outside_triggers(sentence)
    context = content(text)
    spans = []
    for match in WORDS.finditer(text):
        original = match.group()
        word = original.casefold()
        if len(word) < 5 or word in STOP or not word.isascii() or original.isupper():
            continue
        if original[0].isupper() and text[:match.start()].strip():
            continue
        replacement = PLAIN.get(word)
        if not replacement and 2.3 <= zipf_frequency(word, "en") <= 4.15:
            for pos in ("v", "n", "a"):
                lemma = base_form(word, pos)
                if lemma in PLAIN:
                    replacement = inflect_like(word, lemma, PLAIN[lemma], pos)
                    if replacement:
                        break
            if not replacement:
                replacement = better_synonym(word, context - {word}, simpler=True)
        if replacement:
            spans.append(word_span(match, replacement))
    return spans
