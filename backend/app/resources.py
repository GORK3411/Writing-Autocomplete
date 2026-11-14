"""Local asset paths and shared CPU inference."""

from functools import lru_cache
import json
from hashlib import file_digest
from pathlib import Path
from threading import BoundedSemaphore, Lock, RLock

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MODELS = ROOT / "models"


generation_lock = Lock()
generation_slots = BoundedSemaphore(2)
encoder_lock = Lock()
# NLTK reuses a mutable ZipFile handle across WordNet lookups.
wordnet_lock = RLock()


class AssetUnavailable(RuntimeError):
    pass


class ModelBusy(RuntimeError):
    pass


def resource_error(name):
    return AssetUnavailable(f"Could not load {name}. Run Setup Smart Writing again.")


def require(path):
    if not path.is_file() or path.stat().st_size == 0:
        raise AssetUnavailable(f"Missing {path.name}. Run Setup Smart Writing before using this feature.")
    return path


MODEL_MANIFEST = json.loads(Path(__file__).with_name("model_manifest.json").read_text(encoding="utf-8"))


def model_directory(name, frontend=None):
    if name == "autocomplete":
        return frontend / "models" / MODEL_MANIFEST[name]["repo"]
    return MODELS / name


def verify_model(name, frontend=None):
    """Check pinned hashes before opening model configs, tokenizers or weights."""
    directory = model_directory(name, frontend)
    for filename, expected in MODEL_MANIFEST[name]["files"].items():
        path = require(directory / filename)
        try:
            if path.stat().st_size != expected["size"]:
                raise resource_error(name)
            with path.open("rb") as file:
                actual = file_digest(file, "sha256").hexdigest()
        except OSError as error:
            raise resource_error(name) from error
        if actual != expected["sha256"]:
            raise resource_error(name)
    return directory


@lru_cache(maxsize=1)
def _load_wordnet():
    import nltk

    path = require(DATA / "nltk" / "corpora" / "wordnet.zip")
    nltk.data.path.insert(0, str(path.parents[1]))
    try:
        nltk.corpus.wordnet.ensure_loaded()
    except (LookupError, OSError) as error:
        raise resource_error("WordNet") from error
    return nltk.corpus.wordnet


def wordnet():
    with wordnet_lock:
        return _load_wordnet()


@lru_cache(maxsize=1)
def encoder():
    from fastembed import TextEmbedding

    path = verify_model("minilm")
    try:
        return TextEmbedding("sentence-transformers/all-MiniLM-L6-v2", threads=2,
                             specific_model_path=str(path), local_files_only=True)
    except Exception as error:
        raise resource_error("MiniLM") from error


def embed(texts):
    import numpy as np

    with encoder_lock:
        model = encoder()
    vectors = np.asarray(list(model.embed(texts, batch_size=16)))
    return vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9)


@lru_cache(maxsize=2)
def generator(name):
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    path = verify_model(name)
    torch.set_num_threads(2)
    options = {"local_files_only": True, "trust_remote_code": False}
    try:
        tokenizer = AutoTokenizer.from_pretrained(path, **options)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            path, use_safetensors=True, local_files_only=True, trust_remote_code=False,
        ).eval()
    except (ValueError, OSError) as error:
        raise resource_error(name) from error
    return tokenizer, model


def generate(name, sentence):
    if not generation_slots.acquire(blocking=False):
        raise ModelBusy("The writing models are busy. Try again in a moment.")
    try:
        with generation_lock:
            return generate_cached(name, sentence)
    finally:
        generation_slots.release()


@lru_cache(maxsize=128)
def generate_cached(name, sentence):
    import torch

    tokenizer, model = generator(name)
    prompt = "grammar: " + sentence if name == "grammar" else sentence
    tokens = tokenizer(prompt, return_tensors="pt", verbose=False)
    if tokens.input_ids.shape[-1] > 200:
        return sentence
    with torch.inference_mode():
        result = model.generate(**tokens, max_new_tokens=min(224, tokens.input_ids.shape[-1] * 2 + 12),
                                num_beams=3, do_sample=False)
    return tokenizer.decode(result[0], skip_special_tokens=True).strip()
