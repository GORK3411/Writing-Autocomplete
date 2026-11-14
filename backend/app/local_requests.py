"""Protect the loopback editor API from other websites and oversized requests."""

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

LOCAL_HOSTS = ["localhost", "127.0.0.1"]
LOCAL_ORIGINS = {f"http://{host}:{port}" for host in LOCAL_HOSTS for port in (8000, 5173)}
# A 2,000-character sentence plus a 300-character query fits even when JSON
# escapes each supplementary Unicode character as a pair of surrogate escapes.
MAX_BODY_BYTES = 32 * 1024

EDITOR_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'wasm-unsafe-eval'; "
    "worker-src 'self' blob:; "
    "style-src 'self' 'unsafe-inline'; "
    "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
)


def replay_body(body, receive):
    sent = False

    async def replay():
        nonlocal sent
        if sent:
            return await receive()
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return replay


class LocalRequests:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        is_api = path.startswith("/api/")
        async def add_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["Referrer-Policy"] = "no-referrer"
                if is_api:
                    headers["Cache-Control"] = "no-store"
                if path in ("/", "/index.html"):
                    headers["Content-Security-Policy"] = EDITOR_POLICY
            await send(message)

        if is_api and scope["method"] == "POST":
            headers = Headers(scope=scope)
            origin = headers.get("origin")
            if origin is not None and origin not in LOCAL_ORIGINS:
                await JSONResponse({"detail": "Open Smart Writing on its local address."}, 403)(scope, receive, add_headers)
                return
            if headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
                await JSONResponse({"detail": "Send a JSON request."}, 415)(scope, receive, add_headers)
                return

            declared = headers.get("content-length", "")
            if declared.isdecimal() and (len(declared) > 10 or int(declared) > MAX_BODY_BYTES):
                await JSONResponse({"detail": "Request body is too large."}, 413)(scope, receive, add_headers)
                return

            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                if len(body) + len(message["body"]) > MAX_BODY_BYTES:
                    await JSONResponse({"detail": "Request body is too large."}, 413)(scope, receive, add_headers)
                    return
                body.extend(message["body"])
                if not message.get("more_body"):
                    break

            receive = replay_body(bytes(body), receive)

        await self.app(scope, receive, add_headers)
