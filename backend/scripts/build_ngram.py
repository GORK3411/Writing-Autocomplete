"""Build the n-gram next-word table used by the frontend's ghost text (feature 4).

For every 1- and 2-word context seen in the corpus, it keeps the few most
frequent next words. The result is a small JSON file the browser loads once
and queries in under a millisecond, with no model to load.

Usage (from backend/, with the venv active):
    python scripts/build_ngram.py                       # WikiText-103, first 20M words
    python scripts/build_ngram.py --max-words 50000000  # bigger corpus = better table, more RAM
    python scripts/build_ngram.py --text-file my.txt    # your own plain-text corpus instead

Output: frontend/public/ngram.json (generated, gitignored)
  {"v": 1,
   "vocab": ["the", "of", ...],        # words by frequency, most frequent first, in their usual casing
   "next":  {"of the": [12, 40, 7], ...}}  # context (lowercase) -> vocab indices of best next words

The tokenisation rules here must stay in sync with frontend/src/ngram.js.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable, Iterator

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / "frontend" / "public" / "ngram.json"

START = "<s>"  # sentence-start context

# Words, plus the tokens that interrupt a context. Commas and hyphens are not
# matched, so they are simply skipped (a context continues across them).
TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*|[0-9]+|<unk>|[.!?;:()\"\[\]]")
SENTENCE_END = {".", "!", "?"}

# WikiText is pre-tokenised: "the company 's", "do n't", "1 @,@ 000", "well @-@ known".
WIKITEXT_CONTRACTION = re.compile(r" (n't|'s|'re|'ve|'ll|'d|'m)\b")


def clean_line(line: str) -> str:
    line = line.strip()
    if not line or line.startswith("="):  # empty, or a "= = Heading = =" line
        return ""
    line = line.replace(" @-@ ", "-").replace(" @,@ ", "").replace(" @.@ ", "")
    return WIKITEXT_CONTRACTION.sub(r"\1", line)


def iter_lines(text_files: list[str] | None) -> Iterator[str]:
    if text_files:
        for path in text_files:
            with open(path, encoding="utf-8", errors="ignore") as f:
                yield from f
        return
    from datasets import load_dataset  # only needed for the default corpus

    # Downloaded once (~300 MB) into the Hugging Face cache, then read locally on later runs.
    ds = load_dataset("Salesforce/wikitext", "wikitext-103-raw-v1", split="train")
    for row in ds:
        yield row["text"]


def iter_sentences(lines: Iterable[str], max_words: int) -> Iterator[list[str | None]]:
    """Yield sentences as lists of word tokens (original casing).

    None marks a break inside a sentence (number, bracket, unknown word...):
    no n-gram is counted across it.
    """
    n_words = 0
    for raw in lines:
        line = clean_line(raw.replace("’", "'"))
        if not line:
            continue
        sent: list[str | None] = []
        for m in TOKEN_RE.finditer(line):
            tok = m.group()
            if tok[0].isalpha():
                sent.append(tok)
                n_words += 1
            elif tok in SENTENCE_END:
                if sent:
                    yield sent
                sent = []
            elif sent and sent[-1] is not None:
                sent.append(None)
        if sent:
            yield sent  # a line end also ends the sentence
        if n_words >= max_words:
            return


def build_vocab(args) -> tuple[list[str], dict[str, int]]:
    """Pass 1: the most frequent words, each in its most common casing."""
    counts: Counter[str] = Counter()
    surface: Counter[str] = Counter()  # casing seen away from sentence start ("I", "Paris")
    for sent in iter_sentences(iter_lines(args.text_file), args.max_words):
        for i, tok in enumerate(sent):
            if tok is None:
                continue
            counts[tok.lower()] += 1
            if i > 0:
                surface[tok] += 1

    words = [w for w, c in counts.most_common(args.vocab) if c >= args.min_count]
    index = {w: i for i, w in enumerate(words)}

    best_form: dict[str, tuple[int, str]] = {}
    for form, c in surface.items():
        low = form.lower()
        if low in index and c > best_form.get(low, (0, ""))[0]:
            best_form[low] = (c, form)
    vocab = [best_form.get(w, (0, w))[1] for w in words]
    return vocab, index


def count_ngrams(args, index: dict[str, int]) -> Counter[str]:
    """Pass 2: count "context\\tnext" pairs for 1-word and 2-word contexts."""
    counts: Counter[str] = Counter()
    for sent in iter_sentences(iter_lines(args.text_file), args.max_words):
        p2, p1 = None, START
        for tok in sent:
            w = tok.lower() if tok is not None else None
            if w is None or w not in index:
                p2 = p1 = None  # break: the next word has no context
                continue
            if p1 is not None:
                counts[f"{p1}\t{w}"] += 1
                if p2 is not None:
                    counts[f"{p2} {p1}\t{w}"] += 1
            p2, p1 = p1, w

        # Keep memory bounded: drop pairs seen once (lossy counting). Frequent
        # pairs are seen many times, so they survive these prunings.
        if len(counts) > args.max_entries:
            counts = Counter({k: c for k, c in counts.items() if c > 1})
    return counts


def build_table(args, counts: Counter[str], index: dict[str, int]) -> dict[str, list[int]]:
    by_ctx: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for key, c in counts.items():
        if c >= args.min_count:
            ctx, w = key.split("\t")
            by_ctx[ctx].append((c, index[w]))

    table: dict[str, list[int]] = {}
    for ctx, items in by_ctx.items():
        items.sort(key=lambda x: (-x[0], x[1]))
        table[ctx] = [i for _, i in items[: args.top_k]]

    # A 2-word context adds nothing if the 1-word back-off already predicts the same words.
    dropped = 0
    for ctx in [c for c in table if " " in c]:
        tri, bi = table[ctx], table.get(ctx.split(" ")[1], [])
        if bi[: len(tri)] == tri:
            del table[ctx]
            dropped += 1
    print(f"  dropped {dropped:,} redundant 2-word contexts")
    return table


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text-file", nargs="+", help="plain-text corpus file(s) instead of WikiText-103")
    ap.add_argument("--max-words", type=int, default=20_000_000, help="corpus words to read (default 20M)")
    ap.add_argument("--vocab", type=int, default=30_000, help="vocabulary size (default 30k)")
    ap.add_argument("--top-k", type=int, default=3, help="next words kept per context (default 3)")
    ap.add_argument("--min-count", type=int, default=3, help="drop pairs seen fewer times (default 3)")
    ap.add_argument("--max-entries", type=int, default=6_000_000, help="prune counts above this many entries")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    t0 = time.time()
    print("pass 1/2: vocabulary")
    vocab, index = build_vocab(args)
    print(f"  {len(vocab):,} words ({time.time() - t0:.0f}s)")

    print("pass 2/2: n-gram counts")
    counts = count_ngrams(args, index)
    print(f"  {len(counts):,} distinct pairs ({time.time() - t0:.0f}s)")

    table = build_table(args, counts, index)
    print(f"  {len(table):,} contexts kept")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"v": 1, "vocab": vocab, "next": table}, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {args.out} ({args.out.stat().st_size / 1e6:.1f} MB) in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
