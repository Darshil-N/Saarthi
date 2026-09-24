"""Shared plumbing for Gemini calls: one configuration point, off-loop execution, error classes.

The google-generativeai SDK is synchronous. Calling it directly inside `async def` code blocks
the whole event loop (every other request) for the duration of the network call, so every call
here runs in a worker thread.
"""
import asyncio
import logging
from typing import Any

import google.generativeai as genai
from google.api_core import exceptions as gexc

from config import settings

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)


class AIServiceError(Exception):
    """A Gemini call failed. `status_code` and `user_message` are safe to return to clients."""

    status_code = 502
    user_message = "The AI service is temporarily unavailable. Please try again."


class AIQuotaError(AIServiceError):
    status_code = 429
    user_message = "The AI service quota has been reached. Please wait a minute and try again."


class AIEmptyResponseError(AIServiceError):
    user_message = "The AI service returned no usable answer. Please try again."


def _classify(exc: Exception) -> AIServiceError:
    if isinstance(exc, (gexc.ResourceExhausted, gexc.TooManyRequests)):
        return AIQuotaError(str(exc))
    if isinstance(exc, ValueError):
        # `response.text` raises ValueError when the reply was blocked or had no candidates.
        return AIEmptyResponseError(str(exc))
    return AIServiceError(str(exc))


async def generate_text(model_name: str, contents: Any) -> str:
    """Run one Gemini generate_content call off the event loop and return the reply text."""

    def _call() -> str:
        return genai.GenerativeModel(model_name).generate_content(contents).text

    try:
        text = await asyncio.to_thread(_call)
    except Exception as exc:
        classified = _classify(exc)
        logger.warning("Gemini call to %s failed (%s): %s", model_name, type(classified).__name__, exc)
        raise classified from exc
    if not text or not text.strip():
        raise AIEmptyResponseError("Empty reply")
    return text


async def embed_text(text: str) -> list[float]:
    """Embed text with the configured Gemini embedding model, off the event loop."""

    def _call() -> list[float]:
        return genai.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_query",
            output_dimensionality=settings.EMBEDDING_DIMENSIONS,
        )["embedding"]

    try:
        return await asyncio.to_thread(_call)
    except Exception as exc:
        classified = _classify(exc)
        logger.warning("Gemini embedding failed (%s): %s", type(classified).__name__, exc)
        raise classified from exc
