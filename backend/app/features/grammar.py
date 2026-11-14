"""Feature 9. Combine conservative spelling and minimally invasive T5 edits."""

from difflib import SequenceMatcher
from functools import lru_cache
from importlib.resources import files
import re

from symspellpy import SymSpell, Verbosity
from wordfreq import zipf_frequency

from app.features.simplify import preserves_details
from app.lexical import TRIGGERS, WORDS, article, match_case, outside_triggers, word_span
from app.resources import generate
from app.schemas import Span

TOKEN = re.compile(r"\w+|[^\w\s]|\s+", re.UNICODE)
ARTICLE = re.compile(r"\b(an?)\s+([a-z]{3,})\b", re.I)


@lru_cache(maxsize=1)
def speller():
    spell = SymSpell(max_dictionary_edit_distance=1)
    dictionary = files("symspellpy").joinpath("frequency_dictionary_en_82_765.txt")
    spell.load_dictionary(str(dictionary), term_index=0, count_index=1)
    return spell


def spelling_edits(sentence):
    spans = []
    text = outside_triggers(sentence)
    for match in WORDS.finditer(text):
        original = match.group()
        word = original.casefold()
        if (len(word) < 4 or not word.isascii() or not word.isalpha() or original.isupper()
                or (original[0].isupper() and text[:match.start()].strip())
                or zipf_frequency(word, "en") >= 3.5):
            continue
        candidates = speller().lookup(word, Verbosity.CLOSEST, max_edit_distance=1)
        if candidates and candidates[0].distance == 1:
            best = candidates[0]
            second = candidates[1].count if len(candidates) > 1 else 0
            if (best.count > 50_000 and best.count >= second * 2
                    and zipf_frequency(best.term, "en") >= zipf_frequency(word, "en") + 1.0):
                spans.append(word_span(match, best.term))
    return spans


def diff_edits(original, corrected):
    """Diff word, punctuation and whitespace tokens while keeping exact offsets."""
    before = list(TOKEN.finditer(original))
    after = list(TOKEN.finditer(corrected))
    old_offsets = [token.start() for token in before] + [len(original)]
    new_offsets = [token.start() for token in after] + [len(corrected)]
    matcher = SequenceMatcher(None, [m.group() for m in before],
                              [m.group() for m in after], autojunk=False)
    edits = []
    for action, i, j, a, b in matcher.get_opcodes():
        if action == "equal":
            continue
        start, end = old_offsets[i], old_offsets[j]
        edits.append(Span(start=start, end=end, text=original[start:end],
                          suggestion=corrected[new_offsets[a]:new_offsets[b]]))
    return edits


def find_errors(sentence: str, thorough: bool = True) -> list[Span]:
    spelling = spelling_edits(sentence)
    if not thorough or not re.search(r"[A-Za-z]", sentence) or TRIGGERS.search(sentence):
        return spelling
    prepared = sentence
    for edit in reversed(spelling):
        prepared = prepared[:edit.start] + edit.suggestion + prepared[edit.end:]

    def fix_article(match):
        current, next_word = match.groups()
        if not next_word.islower():
            return match.group()
        return match_case(current, article(next_word)) + match.group()[len(current):]

    corrected = generate("grammar", prepared)
    if any(not re.search(rf"\b{re.escape(edit.suggestion)}\b", corrected, re.I) for edit in spelling):
        corrected = prepared
    corrected = ARTICLE.sub(fix_article, corrected)
    if not corrected or not preserves_details(sentence, corrected):
        return spelling
    proposed = diff_edits(sentence, corrected)
    budget = max(3, len(WORDS.findall(sentence)) // 3)
    affected = sum(max(len(WORDS.findall(span.text)), len(WORDS.findall(span.suggestion)))
                   for span in proposed)
    if affected > budget or not WORDS.search(corrected) or len(proposed) > budget + 2:
        return spelling
    return proposed
