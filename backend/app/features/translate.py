"""Feature 2. Look up French or Arabic and rank English senses in context."""

from collections import defaultdict
from functools import lru_cache
import re
import unicodedata

from app.lexical import outside_triggers, senses, match_case
from app.search import trigger_match
from app.resources import DATA, embed, require
from app.schemas import Candidate
from wordfreq import zipf_frequency

ARABIC = re.compile(r"[\u0600-\u06ff]")


def normalize(word, strip_marks=False):
    word = unicodedata.normalize("NFC", word.strip().casefold()).replace("\u0640", "")
    if not strip_marks:
        return word
    decomposed = unicodedata.normalize("NFD", word)
    return unicodedata.normalize("NFC", "".join(c for c in decomposed
                                              if unicodedata.category(c) != "Mn"))


@lru_cache(maxsize=2)
def dictionary(language):
    exact = defaultdict(set)
    folded = defaultdict(set)
    path = require(DATA / f"{language}-en.txt")
    with path.open(encoding="utf-8") as file:
        for line in file:
            fields = line.split()
            if len(fields) != 2:
                continue
            source, target = fields
            if zipf_frequency(target, "en") < 2.3:
                continue
            exact[normalize(source)].add(target)
            folded[normalize(source, True)].add(target)
    return exact, folded


def translate_word(query: str, sentence: str, trigger_start: int | None = None) -> list[Candidate]:
    if not query.strip() or len(query.split()) != 1:
        return []
    language = "ar" if ARABIC.search(query) else "fr"
    exact, folded = dictionary(language)
    found = exact.get(normalize(query)) or folded.get(normalize(query, True)) or set()
    words = sorted(found, key=lambda word: (-zipf_frequency(word, "en"), word))[:12]
    context = outside_triggers(sentence).strip()
    scores = {word: zipf_frequency(word, "en") / 10 for word in words}
    if len(words) > 1 and re.search(r"\w", context):
        glosses = [(word, word + ": " + synset.definition()) for word in words for synset in senses(word)[:4]]
        if glosses:
            vectors = embed([context, *(gloss for _, gloss in glosses)])
            context_scores = {}
            for (word, _), cosine in zip(glosses, vectors[1:] @ vectors[0]):
                context_scores[word] = max(context_scores.get(word, 0), float(cosine))
            for word in words:
                scores[word] = 0.25 * scores[word] + 0.75 * context_scores.get(word, 0)
    match = trigger_match(query, sentence, trigger_start, "[")
    capital = match is not None and not sentence[:match.start()].strip()
    return [Candidate(text=match_case("Example", word) if capital else word, score=min(scores[word], 1))
            for word in sorted(words, key=lambda word: (-scores[word], word))[:5]]
