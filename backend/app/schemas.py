"""Request / response shapes shared by the API and the feature modules."""

from pydantic import BaseModel, Field

# Limits keep one request from tying up a model for too long.
MAX_SENTENCE = 2000
MAX_QUERY = 300


# ---- features 1-3: text inside "...", [...] or {...} -> candidates ----


class TriggerRequest(BaseModel):
    query: str = Field(..., max_length=MAX_QUERY, description="Text between the quotes / brackets")
    sentence: str = Field("", max_length=MAX_SENTENCE, description="Whole sentence, as context for reranking")


class Candidate(BaseModel):
    text: str = Field(..., description="Word or expression that replaces the whole trigger")
    score: float = Field(..., ge=0, le=1, description="Confidence, 0..1")


class CandidatesResponse(BaseModel):
    candidates: list[Candidate] = Field(..., description="Best first")


# ---- features 5-9: one sentence in ----


class SentenceRequest(BaseModel):
    sentence: str = Field(..., max_length=MAX_SENTENCE)


class DifficultyResponse(BaseModel):
    score: float = Field(..., ge=0, le=100, description="0 = easy, 100 = hard")
    hard: bool = Field(..., description="Highlight this sentence in pink")


class SimplifyResponse(BaseModel):
    simplified: str


class Span(BaseModel):
    """A piece of the sentence to highlight, with its replacement.

    `start` / `end` are Python string indices into the sentence (end excluded), so
    sentence[start:end] == text.
    """

    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)
    text: str
    suggestion: str


class SpansResponse(BaseModel):
    spans: list[Span]
