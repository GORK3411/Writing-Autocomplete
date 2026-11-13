"""HTTP routes, one per feature (feature 4 runs in the browser and has none).

The routes only translate HTTP <-> Python: the work happens in app/features/.
Routes are plain `def` (not `async def`) so FastAPI runs them in a thread pool and a
slow model doesn't block the other requests.
"""

from fastapi import APIRouter

from app.features.better_words import find_better_words
from app.features.describe import describe_to_words
from app.features.difficulty import score_sentence
from app.features.grammar import find_errors
from app.features.hard_words import find_hard_words
from app.features.idiom import find_idioms
from app.features.simplify import simplify_sentence
from app.features.translate import translate_word
from app.schemas import (
    CandidatesResponse,
    DifficultyResponse,
    SentenceRequest,
    SimplifyResponse,
    SpansResponse,
    TriggerRequest,
)

router = APIRouter(prefix="/api")


def _no_query(req: TriggerRequest) -> bool:
    return not req.query.strip()


@router.post("/describe", response_model=CandidatesResponse, tags=["1 description to word"])
def describe(req: TriggerRequest) -> CandidatesResponse:
    """Feature 1: "a person who writes books" -> author."""
    if _no_query(req):
        return CandidatesResponse(candidates=[])
    return CandidatesResponse(candidates=describe_to_words(req.query, req.sentence))


@router.post("/translate", response_model=CandidatesResponse, tags=["2 word in another language"])
def translate(req: TriggerRequest) -> CandidatesResponse:
    """Feature 2: [fatigué] -> tired."""
    if _no_query(req):
        return CandidatesResponse(candidates=[])
    return CandidatesResponse(candidates=translate_word(req.query, req.sentence))


@router.post("/idiom", response_model=CandidatesResponse, tags=["3 idiom finder"])
def idiom(req: TriggerRequest) -> CandidatesResponse:
    """Feature 3: {something very easy} -> a piece of cake."""
    if _no_query(req):
        return CandidatesResponse(candidates=[])
    return CandidatesResponse(candidates=find_idioms(req.query, req.sentence))


@router.post("/difficulty", response_model=DifficultyResponse, tags=["5 difficulty score"])
def difficulty(req: SentenceRequest) -> DifficultyResponse:
    """Feature 5: difficulty of one sentence (0..100) and whether to paint it pink."""
    return score_sentence(req.sentence)


@router.post("/simplify", response_model=SimplifyResponse, tags=["6 simplify this"])
def simplify(req: SentenceRequest) -> SimplifyResponse:
    """Feature 6: simpler rewrite of a hard sentence."""
    return SimplifyResponse(simplified=simplify_sentence(req.sentence))


@router.post("/hard-words", response_model=SpansResponse, tags=["7 hard words"])
def hard_words(req: SentenceRequest) -> SpansResponse:
    """Feature 7 (yellow): hard words with a simpler replacement."""
    return SpansResponse(spans=find_hard_words(req.sentence))


@router.post("/better-words", response_model=SpansResponse, tags=["8 better words"])
def better_words(req: SentenceRequest) -> SpansResponse:
    """Feature 8 (blue): weak / repeated words with a stronger replacement."""
    return SpansResponse(spans=find_better_words(req.sentence))


@router.post("/grammar", response_model=SpansResponse, tags=["9 spelling & grammar"])
def grammar(req: SentenceRequest) -> SpansResponse:
    """Feature 9 (red): spelling and grammar errors with their correction."""
    return SpansResponse(spans=find_errors(req.sentence))
