"""Fetch pinned inference assets and dictionaries into repository-local directories."""

from concurrent.futures import ThreadPoolExecutor
from hashlib import file_digest
import json
from pathlib import Path
import shutil
import time
from tempfile import NamedTemporaryFile
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend" / "data"
PUBLIC = ROOT / "frontend" / "public"
HUB = "https://huggingface.co"

MODELS = json.loads((ROOT / "backend" / "app" / "model_manifest.json").read_text(encoding="utf-8"))

def digest(path):
    with path.open("rb") as file:
        return file_digest(file, "sha256").hexdigest()


def download(url, path, expected=None, size=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    checksum = path.with_name(path.name + ".sha256")
    saved = expected or (checksum.read_text().strip() if checksum.exists() else None)
    if path.is_file() and saved and (size is None or path.stat().st_size == size) and digest(path) == saved:
        return
    for attempt in range(3):
        with NamedTemporaryFile(dir=path.parent, suffix=".part", delete=False) as staging:
            temporary = Path(staging.name)
        try:
            with urlopen(Request(url, headers={"User-Agent": "SmartWriting/classroom"}), timeout=45) as response:
                length = response.headers.get("Content-Length")
                with temporary.open("wb") as output:
                    shutil.copyfileobj(response, output)
            actual = temporary.stat().st_size
            if actual == 0 or (length and actual != int(length)) or (size is not None and actual != size):
                raise ValueError(f"Incomplete download for {path.name}")
            checksum_value = digest(temporary)
            if expected and checksum_value != expected:
                raise ValueError(f"Checksum mismatch for {path.name}")
            temporary.replace(path)
            checksum.write_text(checksum_value, encoding="ascii")
            print(f"Prepared {path.relative_to(ROOT)} ({actual / 1e6:.1f} MB)", flush=True)
            return
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
        finally:
            temporary.unlink(missing_ok=True)


def prepare_model(name, specification):
    repo = specification["repo"]
    revision = specification["revision"]
    destination = PUBLIC / "models" / repo if name == "autocomplete" else ROOT / "backend" / "models" / name
    for file, expected in specification["files"].items():
        download(f"{HUB}/{repo}/resolve/{revision}/{file}", destination / file,
                 expected["sha256"], expected["size"])


def prepare_dictionaries():
    dictionaries = {
        "fr": "8fd71b3f8ee20b4fe85d3f694153c9b6bcff59a7a595570787c926ac7e1260f0",
        "ar": "dc85603724b23cfd9d7d5d0920e5effd8c933fec127cde66cdb6382db14e37d8",
    }
    for language, checksum in dictionaries.items():
        name = f"{language}-en.txt"
        download(f"https://dl.fbaipublicfiles.com/arrival/dictionaries/{name}", DATA / name, checksum)
    archive = DATA / "nltk" / "corpora" / "wordnet.zip"
    download("https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip", archive,
             "cbda5ea6eef7f36a97a43d4a75f85e07fccbb4f23657d27b4ccbc93e2646ab59")
    with ZipFile(archive) as words:
        if words.testzip():
            raise ValueError("WordNet archive failed its integrity check")


def main():
    with ThreadPoolExecutor(max_workers=5) as pool:
        jobs = [pool.submit(prepare_model, name, spec) for name, spec in MODELS.items()]
        jobs.append(pool.submit(prepare_dictionaries))
        for job in jobs:
            job.result()


if __name__ == "__main__":
    main()
