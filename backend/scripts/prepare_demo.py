"""Prepare all local runtime files and run the locked Vite build."""

import json
import os
from urllib.request import urlopen
import shutil
import subprocess
import sys

from download_assets import ROOT, PUBLIC, DATA, download, main as download_assets

WIKITEXT_REVISION = "b08601e04326c79dfdd32d625aee71d232d685c3"
WIKITEXT_SHARD = "wikitext-103-raw-v1/train-00000-of-00002.parquet"
RUNTIME_FILES = ("ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm")


def prepare_corpus():
    """Read only the pinned first training shard, which covers the builder's word budget."""
    from pyarrow.parquet import ParquetFile

    source = DATA / "wikitext-103-train.parquet"
    text = DATA / "wikitext-103-train.txt"
    if text.is_file() and text.stat().st_size > 0:
        return text
    hub = "https://huggingface.co"
    with urlopen(f"{hub}/api/datasets/Salesforce/wikitext/revision/{WIKITEXT_REVISION}?blobs=true",
                 timeout=30) as response:
        metadata = json.load(response)
    entry = next(row for row in metadata["siblings"] if row["rfilename"] == WIKITEXT_SHARD)
    download(f"{hub}/datasets/Salesforce/wikitext/resolve/{WIKITEXT_REVISION}/{WIKITEXT_SHARD}?download=true",
             source, entry["lfs"]["sha256"], entry["size"])
    pending = text.with_suffix(".txt.part")
    with pending.open("w", encoding="utf-8", newline="\n") as output:
        for batch in ParquetFile(source).iter_batches(columns=["text"]):
            output.writelines(row + "\n" for row in batch.column(0).to_pylist())
    pending.replace(text)
    return text


def main():
    download_assets()

    fonts = "https://cdn.jsdelivr.net/npm/@fontsource"
    download(f"{fonts}/caveat@5.2.8/files/caveat-latin-700-normal.woff2", PUBLIC / "fonts/caveat.woff2")
    download(f"{fonts}/patrick-hand@5.2.8/files/patrick-hand-latin-400-normal.woff2",
             PUBLIC / "fonts/patrick-hand.woff2")

    download(f"{fonts}/caveat@5.2.8/LICENSE", PUBLIC / "fonts/Caveat-LICENSE.txt")
    download(f"{fonts}/patrick-hand@5.2.8/LICENSE", PUBLIC / "fonts/Patrick-Hand-LICENSE.txt")

    frontend = ROOT / "frontend"
    ort = frontend / "node_modules" / "onnxruntime-web" / "dist"
    (PUBLIC / "ort").mkdir(parents=True, exist_ok=True)
    for name in RUNTIME_FILES:
        shutil.copyfile(ort / name, PUBLIC / "ort" / name)

    ngram = PUBLIC / "ngram.json"
    try:
        saved = json.loads(ngram.read_text(encoding="utf-8"))
        valid = saved.get("v") == 1 and saved["vocab"] and saved["next"]
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        valid = False
    if not valid:
        pending = ngram.with_suffix(".json.part")
        corpus = prepare_corpus()
        subprocess.run([sys.executable, str(ROOT / "backend/scripts/build_ngram.py"),
                        "--text-file", str(corpus), "--out", str(pending)], check=True)
        table = json.loads(pending.read_text(encoding="utf-8"))
        if table.get("v") != 1 or not table["vocab"] or not table["next"]:
            raise ValueError("The generated n-gram table is invalid.")
        pending.replace(ngram)
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if npm is None:
        raise RuntimeError("Install Node.js with npm before running setup.")
    subprocess.run([npm, "run", "build"], cwd=frontend, check=True)


if __name__ == "__main__":
    main()
