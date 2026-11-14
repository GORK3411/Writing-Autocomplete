"""Local API and same-origin classroom editor."""

import os

# Loading model assets is an explicit setup step.
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import router
from app.local_requests import LOCAL_HOSTS, LocalRequests
from app.readiness import missing_files
from app.resources import AssetUnavailable, ModelBusy, ROOT

app = FastAPI(title="Smart Writing Autocomplete API", version="1.0.0")
app.add_middleware(LocalRequests)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=LOCAL_HOSTS, www_redirect=False)
app.include_router(router)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, error: RequestValidationError):
    details = [
        {
            "loc": issue["loc"],
            "msg": "Malformed JSON." if issue["type"] == "json_invalid" else issue["msg"],
            "type": issue["type"],
        }
        for issue in error.errors()
    ]
    return JSONResponse({"detail": details}, status_code=422)


@app.exception_handler(AssetUnavailable)
async def missing_asset(_request: Request, error: AssetUnavailable):
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.exception_handler(ModelBusy)
async def busy(_request: Request, error: ModelBusy):
    return JSONResponse({"detail": str(error)}, status_code=503, headers={"Retry-After": "1"})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def ready():
    missing = missing_files()
    return JSONResponse(status_code=503 if missing else 200,
                        content={"ready": not missing, "missing": missing})


dist = ROOT.parent / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="editor")
