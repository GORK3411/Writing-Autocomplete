from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router

app = FastAPI(title="Smart Writing Autocomplete API", version="0.1.0")
app.include_router(router)

# The frontend (web app or browser extension) runs on a different origin.
# Tighten this list once the frontend is decided.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
