"""Feature 6: "Simplify this" — rewrite a hard (pink) sentence in simpler words.

Heavy model: the frontend only calls it for sentences feature 5 marked as hard, and
caches the answer.

Planned: T5 fine-tuned for simplification on ASSET / WikiLarge.
"""


def simplify_sentence(sentence: str) -> str:
    """Simpler version of `sentence`. Return `sentence` unchanged if there is nothing to simplify."""
    return "Despite the effects of moving, the decision came down to money."  # DUMMY
