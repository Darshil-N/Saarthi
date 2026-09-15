import json
import re
import uuid
from typing import Optional
import google.generativeai as genai
from supabase import Client
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)


async def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dim embedding using Gemini gemini-embedding-2."""
    result = genai.embed_content(
        model="models/gemini-embedding-2",
        content=text,
        task_type="retrieval_query",
        output_dimensionality=768,
    )
    return result["embedding"]


async def find_similar_materials(
    supabase: Client,
    embedding: list[float],
    top_k: int = 5,
    threshold: float = 0.70,
) -> list[dict]:
    """
    Run a pgvector cosine-similarity search against materials.embedding.
    Returns up to top_k rows with similarity >= threshold.
    """
    # Call the Supabase RPC function for vector search
    resp = supabase.rpc(
        "search_materials_by_embedding",
        {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": top_k,
        },
    ).execute()
    return resp.data or []
