"""Shared tokenization, sense selection and casing for lexical features."""

from functools import lru_cache
import re

from lemminflect import getInflection
from wordfreq import zipf_frequency

from app.resources import wordnet, wordnet_lock
from app.schemas import Span

TRIGGERS = re.compile(r'"[^"\n]*"?|\[[^\]\n]*\]?|\{[^}\n]*\}?')
WORDS = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*", re.UNICODE)
STOP = set("a an the something someone person thing of to in on at who what that which is it for by with "
           "be being was were are am and or as from so very this these those have has had do did does "
           "i you he she they we me them him her our their your my his its us there about when how than "
           "some any all not no one more most only into can could would should will been".split())

PLAIN = {
    "utilize": "use", "commence": "begin", "terminate": "end", "purchase": "buy",
    "approximately": "about", "subsequent": "later", "numerous": "many",
    "sufficient": "enough", "assistance": "help", "require": "need",
    "demonstrate": "show", "facilitate": "help", "endeavor": "try",
    "remuneration": "pay", "ascertain": "find", "ameliorate": "improve",
    "necessitate": "require", "disseminate": "spread", "expeditiously": "quickly",
}


def outside_triggers(text):
    return TRIGGERS.sub(lambda match: " " * len(match.group()), text)


def content(text):
    return {match.group().casefold() for match in WORDS.finditer(text)
            if match.group().casefold() not in STOP}


def article(word):
    first = word.split()[0].lower()
    if first.startswith(("hour", "honest", "honor", "heir")):
        return "an"
    if first.startswith(("uni", "use", "user", "euro", "one", "ubiq")):
        return "a"
    return "an" if first[:1] in "aeiou" else "a"


def match_case(word, replacement):
    if word.isupper():
        return replacement.upper()
    if word[:1].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


@lru_cache(maxsize=3000)
def senses(word):
    with wordnet_lock:
        return wordnet().synsets(word)


def base_form(word, pos):
    with wordnet_lock:
        return wordnet().morphy(word, pos)


def inflect_like(word, lemma, replacement, pos):
    if word == lemma:
        return replacement
    tags = {"n": ("NNS",), "v": ("VBD", "VBN", "VBG", "VBZ"),
            "a": ("JJR", "JJS"), "s": ("JJR", "JJS")}.get(pos, ())
    for tag in tags:
        if word in getInflection(lemma, tag=tag):
            forms = getInflection(replacement, tag=tag)
            return forms[0] if forms else None
    return None


def better_synonym(word, context, simpler=False):
    word = word.casefold()
    synsets = senses(word)
    if not synsets:
        return None
    ranked = sorted(synsets, key=lambda s: -len(context & content(
        " ".join([s.definition(), *s.examples()]))))
    sense = ranked[0]
    # Multiple meanings need some contextual evidence to justify a change.
    evidence = len(context & content(" ".join([sense.definition(), *sense.examples()])))
    if len(synsets) > 1:
        second = ranked[1]
        if evidence <= len(context & content(" ".join([second.definition(), *second.examples()]))):
            return None
    lemma = base_form(word, sense.pos()) or word
    choices = []
    for item in sense.lemmas():
        name = item.name()
        if name == lemma or not name.isalpha() or not name.islower():
            continue
        replacement = inflect_like(word, lemma, name, sense.pos())
        if replacement and replacement != word and zipf_frequency(replacement, "en") >= 3:
            choices.append(replacement)
    if simpler:
        threshold = zipf_frequency(word, "en") + 0.5
        choices = [choice for choice in choices if zipf_frequency(choice, "en") >= threshold]
    return max(choices, key=lambda choice: (zipf_frequency(choice, "en"), choice), default=None)


def word_span(match, replacement):
    return Span(start=match.start(), end=match.end(), text=match.group(),
                suggestion=match_case(match.group(), replacement))
