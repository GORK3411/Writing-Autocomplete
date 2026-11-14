"""Files required for a cold offline start."""

from app.resources import DATA, MODEL_MANIFEST, ROOT, model_directory


def missing_files():
    dist = ROOT.parent / "frontend" / "dist"
    expected = [
        DATA / "nltk" / "corpora" / "wordnet.zip",
        DATA / "fr-en.txt", DATA / "ar-en.txt",
        dist / "index.html", dist / "ngram.json", dist / "fonts" / "caveat.woff2",
        dist / "fonts" / "patrick-hand.woff2",
        dist / "ort" / "ort-wasm-simd-threaded.asyncify.mjs",
        dist / "ort" / "ort-wasm-simd-threaded.asyncify.wasm",
    ]
    for name, spec in MODEL_MANIFEST.items():
        directory = model_directory(name, dist)
        expected.extend(directory / filename for filename in spec["files"])
    return [path.relative_to(ROOT.parent).as_posix()
            for path in expected if not path.is_file() or path.stat().st_size == 0]
