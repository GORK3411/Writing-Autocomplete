import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.features.grammar import diff_edits
from app.features.simplify import preserves_details
from app.local_requests import MAX_BODY_BYTES
from app.main import app
from app.resources import AssetUnavailable, ModelBusy, generate, generation_slots, verify_model
from app.schemas import Candidate, Span
from app.search import word_candidate


class AppTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, base_url="http://127.0.0.1:8000")

    def test_api_rejects_nonlocal_hosts_and_browser_origins(self):
        path = "/api/difficulty"
        body = {"sentence": "A local draft."}
        self.assertEqual(self.client.post(path, json=body, headers={"Host": "rebound.example"}).status_code, 400)
        for origin in ("https://outside.example", "null", "http://127.0.0.1:9999"):
            with self.subTest(origin=origin):
                self.assertEqual(self.client.post(path, json=body, headers={"Origin": origin}).status_code, 403)
        for origin in ("http://127.0.0.1:8000", "http://localhost:5173"):
            self.assertEqual(self.client.post(path, json=body, headers={"Origin": origin}).status_code, 200)

    def test_body_limit_counts_streamed_bytes_and_accepts_json(self):
        path = "/api/difficulty"
        chunks = (b" " * 8192 for _ in range(MAX_BODY_BYTES // 8192 + 1))
        self.assertEqual(self.client.post(path, content=chunks, headers={
            "Content-Type": "application/json",
        }).status_code, 413)
        self.assertEqual(self.client.post(path, data={"sentence": "A draft."}).status_code, 415)
        self.assertEqual(self.client.post(path, json={"sentence": "A draft."}).status_code, 200)

    def test_validation_does_not_echo_draft(self):
        path = "/api/difficulty"
        response = self.client.post(path, json={"sentence": "PRIVATE_DRAFT_" * 200})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("PRIVATE_DRAFT", response.text)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        response = self.client.post(path, content=b'{"sentence":"\\ud800"}',
                                    headers={"Content-Type": "application/json"})
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/api/describe", json={
            "query": "person", "sentence": '"person"', "trigger_start": 8,
        })
        self.assertEqual(response.status_code, 422)

    def test_ready_reports_missing_files_without_loading_models(self):
        with patch("app.main.missing_files", return_value=["frontend/dist/index.html"]):
            response = self.client.get("/ready")
            self.assertEqual(response.status_code, 503)
            self.assertFalse(response.json()["ready"])
        with patch("app.main.missing_files", return_value=[]):
            self.assertEqual(self.client.get("/ready").json(), {"ready": True, "missing": []})

    def test_model_queue_refuses_overload_and_recovers_after_error(self):
        generation_slots.acquire()
        generation_slots.acquire()
        try:
            with self.assertRaises(ModelBusy):
                generate("grammar", "A sentence.")
        finally:
            generation_slots.release()
            generation_slots.release()
        with patch("app.resources.generate_cached", side_effect=ValueError("Model failure")):
            with self.assertRaises(ValueError):
                generate("grammar", "A sentence.")
        with patch("app.resources.generate_cached", return_value="A sentence."):
            self.assertEqual(generate("grammar", "A sentence."), "A sentence.")
        with patch("app.api.find_errors", side_effect=ModelBusy("Try again.")):
            response = self.client.post("/api/grammar", json={"sentence": "A sentence."})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["Retry-After"], "1")

    def test_model_integrity_rejects_same_size_replacement(self):
        from hashlib import sha256

        with TemporaryDirectory() as temp:
            root = Path(temp)
            model = root / "grammar"
            model.mkdir()
            path = model / "config.json"
            path.write_bytes(b"good")
            manifest = {"grammar": {"files": {
                "config.json": {"size": 4, "sha256": sha256(b"good").hexdigest()},
            }}}
            with patch("app.resources.MODEL_MANIFEST", manifest), patch("app.resources.MODELS", root):
                self.assertEqual(verify_model("grammar"), model)
                path.write_bytes(b"evil")
                with self.assertRaises(AssetUnavailable):
                    verify_model("grammar")

    def test_lookup_routes_and_limits(self):
        for path in ("describe", "translate", "idiom"):
            self.assertEqual(self.client.post("/api/" + path, json={"query": " "}).json(), {"candidates": []})
            self.assertEqual(self.client.post("/api/" + path, json={"query": "a" * 301}).status_code, 422)
        self.assertEqual(self.client.post("/api/grammar", json={"sentence": "a" * 2001}).status_code, 422)

    def test_backend_keeps_original_routes(self):
        for path, name, result, expected in [
            ("describe", "describe_to_words", [Candidate(text="author", score=0.9)], "candidates"),
            ("translate", "translate_word", [], "candidates"),
            ("idiom", "find_idioms", [], "candidates"),
            ("simplify", "simplify_sentence", "Simple text.", "simplified"),
            ("hard-words", "find_hard_words", [], "spans"),
            ("better-words", "find_better_words", [], "spans"),
            ("grammar", "find_errors", [], "spans"),
        ]:
            with self.subTest(path=path), patch("app.api." + name, return_value=result):
                response = self.client.post("/api/" + path, json={"query": "valid", "sentence": "A sentence."})
                self.assertEqual(response.status_code, 200)
                self.assertIn(expected, response.json())

    def test_difficulty_and_hard_words_rules(self):
        def post(path, sentence):
            return self.client.post("/api/" + path, json={"sentence": sentence}).json()

        self.assertLess(post("difficulty", "The dog ran.")["score"],
                        post("difficulty", "The interdisciplinary investigation necessitated substantial reorganization.")["score"])
        self.assertEqual(post("hard-words", "We will utilize it.")["spans"][0]["suggestion"], "use")
        self.assertEqual(post("better-words", "It is very big.")["spans"][0]["suggestion"], "huge")

    def test_unavailable_is_503(self):
        with patch("app.api.find_idioms", side_effect=AssetUnavailable("Missing encoder.")):
            response = self.client.post("/api/idiom", json={"query": "some meaning"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("Missing encoder", response.json()["detail"])

    def test_candidate_edit_disambiguates_repeated_triggers(self):
        text = '🙂 I have "a person" and I am "a person".'
        start = text.rindex('"a person"')
        candidate = word_candidate("author", 0.9, "a person", text, start)
        self.assertEqual(candidate.edit, Span(start=start, end=start + 10, text='"a person"', suggestion="an author"))
        self.assertIsNone(word_candidate("author", 0.9, "a person", text, None).edit)
        text = 'I hired a "person who writes books".'
        candidate = word_candidate("author", 0.9, "person who writes books", text, None)
        self.assertEqual(candidate.edit.text, 'a "person who writes books"')
        self.assertEqual(candidate.edit.suggestion, "an author")

    def test_grammar_diff_keeps_exact_code_point_slices(self):
        original = "🙂 She went school and saw the the dog."
        corrected = "🙂 She went to school and saw a dog."
        edits = diff_edits(original, corrected)
        result = original
        for edit in reversed(edits):
            self.assertEqual(original[edit.start:edit.end], edit.text)
            result = result[:edit.start] + edit.suggestion + result[edit.end:]
        self.assertEqual(result, corrected)
        self.assertTrue(any(edit.start == edit.end for edit in edits))
        self.assertTrue(any(not edit.suggestion for edit in diff_edits("a a test", "a test")))

    def test_rewrite_rejects_changed_numbers_or_negation(self):
        self.assertFalse(preserves_details("We did not move 10 desks.", "We moved 10 desks."))
        self.assertFalse(preserves_details("There are 11 desks.", "There are 12 desks."))
        self.assertTrue(preserves_details("We did not utilize 12 desks.", "We didn't use 12 desks."))

    def test_thorough_check_preserves_conservative_spelling(self):
        with patch("app.features.grammar.generate", return_value="She categorically agrees."):
            result = self.client.post("/api/grammar", json={"sentence": "She definately agrees."})
        self.assertEqual(result.json()["spans"][0]["suggestion"], "definitely")

    def test_simplification_rejects_large_content_deletion(self):
        sentence = "The librarian subsequently commenced the organization of the 12 publications."
        with patch("app.features.simplify.generate", return_value="The librarian then started the 12 publications."):
            result = self.client.post("/api/simplify", json={"sentence": sentence})
        self.assertEqual(result.json()["simplified"], sentence)

    def test_catalog_size_sources_and_uniqueness(self):
        path = Path(__file__).resolve().parents[1] / "app" / "features" / "idioms.json"
        rows = json.loads(path.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(rows), 150)
        self.assertEqual(len(rows), len({row["idiom"] for row in rows}))
        self.assertTrue(all(row["source"].startswith("https://en.wiktionary.org/wiki/") for row in rows))


if __name__ == "__main__":
    unittest.main()
