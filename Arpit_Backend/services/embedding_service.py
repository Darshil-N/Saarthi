import asyncio

from supabase import Client

from config import settings
from services.ai_common import embed_text


async def generate_embedding(text: str) -> list[float]:
    """Embed text with the configured Gemini model.

    The model and dimensionality must match the ones used for the stored materials.embedding
    vectors (seed_embeddings.py); cosine similarity across different models is meaningless.
    """
    return await embed_text(text)


async def find_similar_materials(
    supabase: Client,
    embedding: list[float],
    top_k: int | None = None,
    threshold: float | None = None,
) -> list[dict]:
    """
    Run a pgvector cosine-similarity search against materials.embedding.
    Returns up to top_k rows with similarity >= threshold (defaults come from settings).
    """
    params = {
        "query_embedding": embedding,
        "match_threshold": settings.MATCH_CANDIDATE_THRESHOLD if threshold is None else threshold,
        "match_count": settings.MATCH_CANDIDATE_COUNT if top_k is None else top_k,
    }
    resp = await asyncio.to_thread(
        lambda: supabase.rpc("search_materials_by_embedding", params).execute()
    )
    return resp.data or []
