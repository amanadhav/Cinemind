"""Pydantic request schemas for the CineMind API.

These declare the shape and bounds of every request body / query parameter in
one place. Routes call :func:`validate` which turns any validation failure into
a single ``ValidationError`` carrying a clean, client-safe message — caught by
the app-wide error handler and returned as a 400.

Bounds reflect the MovieLens 25M dataset:
  * user ids   : 1..162541
  * movie ids  : >= 1
  * ratings    : 0.5..5.0 (MovieLens half-star scale)
"""
from typing import List, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError as PydanticValidationError,
    field_validator,
)

# MovieLens 25M bounds.
MIN_USER_ID = 1
MAX_USER_ID = 162541
MIN_RATING = 0.5
MAX_RATING = 5.0
MAX_QUERY_LEN = 100
MAX_TITLE_LEN = 200
MAX_RATINGS_PER_REQUEST = 200


class ValidationError(Exception):
    """Raised when an incoming request fails schema validation.

    Carries a human-readable, client-safe message; the app error handler maps
    it to an HTTP 400 JSON response.
    """

    def __init__(self, message):
        super().__init__(message)
        self.message = message


def _first_error_message(exc: PydanticValidationError) -> str:
    """Collapse a Pydantic error into a single readable sentence."""
    first = exc.errors()[0]
    loc = ".".join(str(p) for p in first.get("loc", ()) if p != "__root__")
    msg = first.get("msg", "invalid value")
    return f"{loc}: {msg}" if loc else msg


def validate(model, data):
    """Validate ``data`` against a Pydantic ``model``.

    Returns the parsed model instance, or raises :class:`ValidationError` with
    a clean message suitable for returning to the client.
    """
    try:
        return model.model_validate(data)
    except PydanticValidationError as exc:
        raise ValidationError(_first_error_message(exc)) from exc


class RatingItem(BaseModel):
    """A single ``{movie_id, rating}`` pair from the cold-start flow."""

    model_config = ConfigDict(extra="ignore")

    movie_id: int = Field(..., ge=1, description="MovieLens movieId")
    rating: float = Field(..., ge=MIN_RATING, le=MAX_RATING)


class ContentRequest(BaseModel):
    """Body for ``POST /api/recommend/content``."""

    model_config = ConfigDict(extra="ignore")

    movie: str = Field(..., min_length=1, max_length=MAX_TITLE_LEN)

    @field_validator("movie")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class CollaborativeRequest(BaseModel):
    """Body for ``POST /api/recommend/collaborative``."""

    model_config = ConfigDict(extra="ignore")

    user_id: int = Field(..., ge=MIN_USER_ID, le=MAX_USER_ID)


class RateRequest(BaseModel):
    """Body for ``POST /api/rate`` (cold-start fold-in)."""

    model_config = ConfigDict(extra="ignore")

    ratings: List[RatingItem] = Field(..., min_length=1, max_length=MAX_RATINGS_PER_REQUEST)


class HybridRequest(BaseModel):
    """Body for ``POST /api/recommend/hybrid``.

    Requires ``movie`` plus exactly one collaborative signal: either a known
    ``user_id`` or a non-empty ``ratings`` list (cold start).
    """

    model_config = ConfigDict(extra="ignore")

    movie: str = Field(..., min_length=1, max_length=MAX_TITLE_LEN)
    user_id: Optional[int] = Field(None, ge=MIN_USER_ID, le=MAX_USER_ID)
    ratings: Optional[List[RatingItem]] = Field(
        None, max_length=MAX_RATINGS_PER_REQUEST
    )

    @field_validator("movie")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("ratings")
    @classmethod
    def _non_empty(cls, v):
        if v is not None and len(v) == 0:
            raise ValueError("must not be empty")
        return v

    def collaborative_signal(self):
        """Return ('ratings', list) or ('user_id', int), or raise if neither."""
        if self.ratings:
            return "ratings", [r.model_dump() for r in self.ratings]
        if self.user_id is not None:
            return "user_id", self.user_id
        raise ValidationError("provide either 'user_id' or 'ratings'")
