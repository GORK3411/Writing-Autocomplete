"""Shortlist definitions with TF-IDF and rerank them with MiniLM cosine."""

from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path
import re
from threading import Lock

from lemminflect import getInflection
from nltk.stem import SnowballStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from wordfreq import zipf_frequency

from app.lexical import STOP, TRIGGERS, WORDS, article, content, match_case, outside_triggers
from app.resources import embed, wordnet, wordnet_lock
from app.schemas import Candidate, Span


@dataclass(frozen=True)
class Definition:
    definition: str
    words: tuple[str, ...]
    keywords: str = ""


index_lock = Lock()
stemmer = SnowballStemmer("english")


@lru_cache(maxsize=16000)
def stem(word):
    return stemmer.stem(word)


def definition_tokens(text):
    return [stem(word) for word in WORDS.findall(text.lower()) if word not in STOP]


@lru_cache(maxsize=2)
def index(kind):
    if kind == "idiom":
        catalog = json.loads((Path(__file__).parent / "features" / "idioms.json").read_text(encoding="utf-8"))
        rows = [Definition(row["meaning"], (row["idiom"],)) for row in catalog]
    else:
        with wordnet_lock:
            rows = []
            for synset in wordnet().all_synsets():
                names = tuple(lemma.name().replace("_", " ") for lemma in synset.lemmas()
                              if lemma.name().islower() and lemma.name().replace("_", "").isalpha())
                if names:
                    # A parent term links descriptions such as "doctor" to specialized words.
                    parents = [lemma.name().replace("_", " ") for parent in synset.hypernyms()
                               for lemma in parent.lemmas()]
                    rows.append(Definition(synset.definition(), names, " ".join(parents)))
    vectorizer = TfidfVectorizer(tokenizer=definition_tokens, token_pattern=None,
                                 ngram_range=(1, 2), sublinear_tf=True)
    matrix = vectorizer.fit_transform(row.definition + " " + row.keywords for row in rows)
    return rows, vectorizer, matrix


@lru_cache(maxsize=128)
def search(query, sentence, kind):
    if not content(query):
        return []
    with index_lock:
        rows, vectorizer, matrix = index(kind)
    lexical = (matrix @ vectorizer.transform([query]).T).toarray().ravel()
    order = lexical.nonzero()[0]
    if not len(order):
        return []
    # A wider word shortlist lets semantic ranking recover glosses with
    # different vocabulary, such as "physician" and "surgery".
    shortlist_size = 140 if kind == "word" else 48
    top = sorted(order, key=lambda idx: (-lexical[idx], idx))[:shortlist_size]
    context = outside_triggers(sentence).strip()
    prompts = [query, context or query, *(rows[idx].definition for idx in top)]
    vectors = embed(prompts)
    semantic = vectors[2:] @ vectors[0]
    contextual = vectors[2:] @ vectors[1]
    scores = {}
    for position, idx in enumerate(top):
        if semantic[position] < (0.32 if kind == "idiom" else 0.29):
            continue
        match = 0.82 * semantic[position] + 0.15 * lexical[idx] + 0.03 * contextual[position]
        for word in rows[idx].words:
            score = float(match)
            if kind == "word":
                score += min(zipf_frequency(word, "en"), 6) * 0.005
            scores[word] = max(scores.get(word, 0), min(score, 1))
    return sorted(scores.items(), key=lambda row: (-row[1], row[0]))[:5]


def trigger_match(query, sentence, trigger_start, opener):
    matches = [match for match in TRIGGERS.finditer(sentence)
               if match.group().startswith(opener)
               and match.group().endswith({"[": "]", "{": "}", '"': '"'}[opener])
               and match.group()[1:-1].strip() == query.strip()]
    if trigger_start is not None:
        return next((match for match in matches if match.start() == trigger_start), None)
    return matches[0] if len(matches) == 1 else None


def word_candidate(word, score, query, sentence, trigger_start):
    match = trigger_match(query, sentence, trigger_start, '"')
    if match is None:
        return Candidate(text=word, score=score)
    start = match.start()
    prefix = sentence[:start]
    replacement = word
    if re.search(r"\b(?:they are|we are|these are|those are|two|three|many|several)\s+$", prefix, re.I):
        head, _, tail = word.rpartition(" ")
        forms = getInflection(tail, tag="NNS")
        if forms:
            replacement = (head + " " + forms[0]).strip()
    existing = re.search(r"\b(an?)\s+$", prefix, re.I)
    if existing:
        start = existing.start()
        replacement = match_case(existing.group(1), article(word)) + " " + word
    elif re.search(r"\b(?:i am|we have|he is|she is|it is|this is|that is)\s+$", prefix, re.I) and re.match(
        r"\s*(?:an?|one)\s+(?:person|thing|place|animal|[a-z]+)\b", query, re.I
    ):
        replacement = article(word) + " " + word
    elif not prefix.strip():
        replacement = replacement[:1].upper() + replacement[1:]
    return Candidate(text=word, score=score, edit=Span(start=start, end=match.end(),
                     text=sentence[start:match.end()], suggestion=replacement))
