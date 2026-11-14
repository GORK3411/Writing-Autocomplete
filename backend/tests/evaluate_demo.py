"""Run real local assets against the fixed classroom examples."""

from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from statistics import quantiles
from time import perf_counter

from fastapi.testclient import TestClient

from app.main import app

CASES = json.loads(Path(__file__).with_name("quality_cases.json").read_text(encoding="utf-8"))


def main():
    client = TestClient(app, base_url="http://127.0.0.1:8000")

    def post(path, payload):
        response = client.post("/api/" + path, json=payload)
        response.raise_for_status()
        return response.json()

    # Exercise concurrent cold WordNet reads before warming it in the quality fixtures.
    def query_wordnet(index):
        if index % 2 == 0:
            return post("describe", {"query": "an animal with hooves", "sentence": ""})
        return post("translate", {"query": "livre", "sentence": "I read a [livre]."})

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert all("candidates" in result for result in pool.map(query_wordnet, range(8)))
    print("Concurrent cold dictionary requests passed.")

    counts = {}
    for endpoint, query, sentence, expected in CASES["retrieval"]:
        choices = post(endpoint, {"query": query, "sentence": sentence})["candidates"]
        result = [value["text"].casefold() for value in choices[:3]]
        correct = bool(set(result) & set(expected)) if expected else not result
        hits, total = counts.get(endpoint, (0, 0))
        counts[endpoint] = (hits + correct, total + 1)
        print(f"{endpoint:9} {correct!s:5} {query} -> {result}")
    print("Top-three or correct abstention:", counts)

    for easy, hard in CASES["difficulty"]:
        easy_score = post("difficulty", {"sentence": easy})["score"]
        hard_score = post("difficulty", {"sentence": hard})["score"]
        print(f"Readability: {easy_score:.0f} vs {hard_score:.0f}")
        assert easy_score < hard_score

    changed_clean = clean_count = exact = 0
    for source, expected in CASES["grammar"]:
        start = perf_counter()
        result = source
        spans = post("grammar", {"sentence": source})["spans"]
        for span in reversed(spans):
            a, b = span["start"], span["end"]
            assert source[a:b] == span["text"]
            result = result[:a] + span["suggestion"] + result[b:]
        if source == expected:
            clean_count += 1
            changed_clean += result != source
        exact += result == expected
        print(f"grammar  {perf_counter() - start:.2f}s {source!r} -> {result!r}")
    print(f"Grammar exact {exact}/{len(CASES['grammar'])}; clean inputs changed {changed_clean}/{clean_count}")

    for source, reference in CASES["simplify"]:
        start = perf_counter()
        result = post("simplify", {"sentence": source})["simplified"]
        print(f"simplify {perf_counter() - start:.2f}s {source!r} -> {result!r}; reference {reference!r}")

    texts = [pair[1] for pair in CASES["difficulty"]] + [
        "We will utilize it.", "It is very big.", "She definately agrees.",
        "Dr. Smith bought 12 apples.", "We finished the project yesterday.",
    ]
    for path in ("difficulty", "hard-words", "better-words", "grammar"):
        samples = []
        for text in texts:
            post(path, {"sentence": text, "thorough": False})
        for _ in range(5):
            for text in texts:
                start = perf_counter()
                post(path, {"sentence": text, "thorough": False})
                samples.append((perf_counter() - start) * 1000)
        print(f"Light {path} p95 {quantiles(samples, n=100, method='inclusive')[94]:.1f} ms ({len(samples)} calls)")


if __name__ == "__main__":
    main()
