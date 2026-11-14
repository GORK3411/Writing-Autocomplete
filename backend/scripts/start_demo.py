"""Start the classroom server and open the editor after readiness succeeds."""

from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.readiness import missing_files
from app.resources import AssetUnavailable, MODEL_MANIFEST, verify_model

HOST, PORT = "127.0.0.1", 8000
URL = f"http://{HOST}:{PORT}"


def main(open_browser=True):
    missing = missing_files()
    if missing:
        print("Run Setup Smart Writing first. Missing:")
        print("\n".join(missing))
        return 1
    with socket.socket() as probe:
        probe.settimeout(0.3)
        if probe.connect_ex((HOST, PORT)) == 0:
            print(f"Port {PORT} is already in use. Close the other server first.")
            return 1
    try:
        for name in MODEL_MANIFEST:
            verify_model(name, BACKEND.parent / "frontend" / "dist")
    except AssetUnavailable as error:
        print(error)
        return 1
    server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app",
                               "--host", HOST, "--port", str(PORT)], cwd=BACKEND)
    try:
        for _ in range(150):
            if server.poll() is not None:
                return server.returncode or 1
            try:
                with urlopen(URL + "/ready", timeout=1):
                    print(f"Smart Writing is ready at {URL}", flush=True)
                    if open_browser:
                        webbrowser.open(URL)
                    return server.wait()
            except (URLError, OSError):
                time.sleep(0.2)
        print("The server did not become ready. See the output above.")
        return 1
    except KeyboardInterrupt:
        return 0
    finally:
        if server.poll() is None:
            server.terminate()
            server.wait()


if __name__ == "__main__":
    raise SystemExit(main(open_browser="--no-browser" not in sys.argv[1:]))
