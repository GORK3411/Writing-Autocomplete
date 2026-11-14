"""Request / response shapes shared by the API and the feature modules."""

from pydantic import BaseModel, Field, field_validator, model_validator

# Limits keep one request from tying up a model for too long.
MAX_SENTENCE = 2000
MAX_QUERY = 300


# ---- features 1-3: text inside "...", [...] or {...} -> candidates ----


def check_unicode(text):
    if any(0xD800 <= ord(char) <= 0xDFFF for char in text):
        raise ValueError("Text must contain valid Unicode.")
    return text


class TriggerRequest(BaseModel):
    trigger_start: int | None = Field(None, ge=0)
    query: str = Field(..., max_length=MAX_QUERY, description="Text between the quotes / brackets")
    sentence: str = Field("", max_length=MAX_SENTENCE, description="Whole sentence, as context for reranking")


    @field_validator("query", "sentence")
    @classmethod
    def valid_text(cls, text):
        return check_unicode(text)

    @model_validator(mode="after")
    def valid_offset(self):
        if self.trigger_start is not None and self.trigger_start >= len(self.sentence):
            raise ValueError("Trigger offset must point inside the sentence.")
        return self


class Span(BaseModel):
    """A piece of the sentence to highlight, with its replacement.

    `start` / `end` are Python string indices into the sentence (end excluded), so
    sentence[start:end] == text.
    """

    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)
    text: str
    suggestion: str

    @model_validator(mode="after")
    def valid_slice(self):
        if self.end - self.start != len(self.text):
            raise ValueError("Span length must match the original text.")
        return self


class Candidate(BaseModel):
    edit: Span | None = None
    text: str = Field(..., description="Word or expression that replaces the whole trigger")
    score: float = Field(..., ge=0, le=1, description="Match score, 0..1")


class CandidatesResponse(BaseModel):
    candidates: list[Candidate] = Field(..., description="Best first")


# ---- features 5-9: one sentence in ----


class SentenceRequest(BaseModel):
    sentence: str = Field(..., max_length=MAX_SENTENCE)


    @field_validator("sentence")
    @classmethod
    def valid_text(cls, text):
        return check_unicode(text)


class GrammarRequest(SentenceRequest):
    thorough: bool = True


class DifficultyResponse(BaseModel):
    score: float = Field(..., ge=0, le=100, description="0 = easy, 100 = hard")
    hard: bool = Field(..., description="Highlight this sentence in pink")


class SimplifyResponse(BaseModel):
    simplified: str


class SpansResponse(BaseModel):
    spans: list[Span]
