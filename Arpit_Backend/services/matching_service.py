import logging

from supabase import Client

from config import settings
from services.ai_common import AIServiceError, generate_text
from services.embedding_service import find_similar_materials, generate_embedding
from services.json_utils import extract_json

logger = logging.getLogger(__name__)

_VALID_MATCH_TYPES = ("exact", "duplicate", "near_duplicate", "equivalent", "different")


def _map_to_match_status(match_type: str, confidence: float) -> str:
    if match_type in ("exact", "duplicate") and confidence > 0.9:
        return "exact_match"
    if match_type in ("near_duplicate", "equivalent"):
        return "near_duplicate"
    if match_type == "different":
        return "new_material"
    return "uncertain"


def is_auto_link(match_type: str, confidence: float) -> bool:
    """True when the AI is sure enough that no human review is needed (plan step 3.2.5)."""
    return match_type == "exact" and confidence > settings.SIMILARITY_EXACT


def _no_match(reason: str, embedding: list[float] | None, status: str = "new_material") -> dict:
    return {
        "match_status": status,
        "matched_material_id": None,
        "matched_description": None,
        "match_type": "different",
        "confidence": 0.0,
        "vector_similarity": 0.0,
        "match_reason": reason,
        "cnmc": None,
        "embedding": embedding,
        "master_candidate": None,
        "auto_link": False,
    }


def _build_prompt(incoming_desc: str, incoming_specs: dict, candidates: list) -> str:
    candidates_text = ""
    for idx, c in enumerate(candidates):
        candidates_text += (
            f"\nCandidate {idx}:\nID: {c['id']}\nDescription: {c.get('standard_description')}\n"
            f"CNMC: {c.get('cnmc')}\nSpecs: {c.get('technical_specs') or c.get('spec')}\n---"
        )
    return f"""
You are an expert material master catalog data steward.
Compare the incoming item with the list of potential master candidates below.
Determine which candidate is the BEST match.

INCOMING ITEM:
Description: {incoming_desc}
Specs: {incoming_specs}

CANDIDATES:
{candidates_text}

Analyze the match and output a raw JSON object (without markdown wrapping) with exactly these fields:
{{
  "best_candidate_id": "<ID of the best matching candidate, or null if none match>",
  "match_type": "<exact|duplicate|near_duplicate|equivalent|different>",
  "confidence": <float between 0.0 and 1.0>,
  "reason": "<short explanation>"
}}
"""


def _parse_verdict(raw: dict) -> tuple[str | None, str, float, str]:
    match_type = str(raw.get("match_type") or "").strip().lower()
    if match_type not in _VALID_MATCH_TYPES:
        raise ValueError(f"Unknown match_type {match_type!r}")
    try:
        confidence = max(0.0, min(1.0, float(raw.get("confidence", 0.0))))
    except (TypeError, ValueError):
        raise ValueError("Confidence is not a number")
    best_id = raw.get("best_candidate_id")
    return (str(best_id) if best_id else None), match_type, confidence, str(raw.get("reason") or "")


async def run_matching(
    supabase: Client,
    incoming_description: str,
    incoming_specs: dict | None = None,
) -> dict:
    """Find the best existing material for an incoming description.

    Never raises for AI failures: if embeddings or the comparison are unavailable the line is
    returned as "uncertain" so a human decides, instead of silently becoming a new material.
    """
    try:
        embedding = await generate_embedding(incoming_description)
    except AIServiceError as exc:
        return _no_match(
            f"AI matching unavailable ({exc.user_message}) - needs manual review.", None, status="uncertain"
        )

    candidates = await find_similar_materials(supabase, embedding)
    logger.info(
        "Matching %r -> %d candidates %s",
        incoming_description[:80],
        len(candidates),
        [(c.get("cnmc"), round(c.get("similarity", 0), 3)) for c in candidates],
    )
    if not candidates:
        return _no_match("No similar material found in the master.", embedding)

    top = candidates[0]  # the RPC orders by similarity
    try:
        verdict = extract_json(
            await generate_text(
                settings.GEMINI_MODEL_MATCHING,
                _build_prompt(incoming_description, incoming_specs or {}, candidates),
            )
        )
        if not isinstance(verdict, dict):
            raise ValueError("Verdict was not a JSON object")
        best_id, match_type, confidence, reason = _parse_verdict(verdict)
    except (AIServiceError, ValueError) as exc:
        logger.warning("AI comparison failed, falling back to vector similarity only: %s", exc)
        similarity = float(top.get("similarity", 0.0))
        return {
            **_no_match("", embedding, status="uncertain"),
            "matched_material_id": top["id"],
            "matched_description": top.get("standard_description"),
            "match_type": "near_duplicate",
            "confidence": similarity,
            "vector_similarity": similarity,
            "match_reason": f"AI comparison unavailable; closest catalog item by similarity ({similarity:.0%}). Please review.",
            "cnmc": top.get("cnmc"),
            "master_candidate": top,
        }

    best = next((c for c in candidates if str(c["id"]) == best_id), None)
    if best is None or match_type == "different":
        return _no_match(reason or "No similar material found in the master.", embedding)

    return {
        "match_status": _map_to_match_status(match_type, confidence),
        "matched_material_id": best["id"],
        "matched_description": best.get("standard_description"),
        "match_type": match_type,
        "confidence": confidence,
        "vector_similarity": best.get("similarity", 0.0),
        "match_reason": reason,
        "cnmc": best.get("cnmc"),
        "embedding": embedding,
        "master_candidate": best,
        "auto_link": is_auto_link(match_type, confidence),
    }
