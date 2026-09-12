import json
import re
import google.generativeai as genai
from supabase import Client
from config import settings
from prompts.prompts import MATCHING_PROMPT
from services.embedding_service import generate_embedding, find_similar_materials

genai.configure(api_key=settings.GEMINI_API_KEY)

EXACT_THRESHOLD = settings.SIMILARITY_EXACT      # 0.95
NEAR_THRESHOLD  = settings.SIMILARITY_NEAR       # 0.75


def _map_to_match_status(match_type: str, confidence: float) -> str:
    """Map Gemini match_type + confidence to frontend match_status field."""
    if match_type in ("exact", "duplicate") and confidence > 0.9:
        return "exact_match"
    if match_type in ("near_duplicate", "equivalent"):
        return "near_duplicate"
    if match_type == "different":
        return "new_material"
    return "uncertain"


async def _call_gemini_matcher(
    desc_a: str,
    cnmc_a: str,
    specs_a: str,
    desc_b: str,
    specs_b: str,
) -> dict:
    """Ask Gemini to classify the relationship between two material descriptions."""
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = MATCHING_PROMPT.format(
        desc_a=desc_a, cnmc_a=cnmc_a, specs_a=specs_a,
        desc_b=desc_b, specs_b=specs_b,
    )
    resp = model.generate_content(prompt)
    raw = resp.text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"match_type": "different", "confidence": 0.0, "reason": "Parse error"}


async def run_matching(
    supabase: Client,
    incoming_description: str,
    incoming_specs: dict | None = None,
    gr_line_item_id: str | None = None,
) -> dict:
    """
    Full matching pipeline:
    1. Generate embedding for incoming description
    2. pgvector similarity search
    3. For top candidates, call Gemini classifier
    4. Insert best result into matching_queue
    5. Return dict with match_status, matched_material_id, confidence, match_reason, cnmc
    """
    embedding = await generate_embedding(incoming_description)
    candidates = await find_similar_materials(supabase, embedding, top_k=5, threshold=0.70)

    best_result = {
        "match_status": "new_material",
        "matched_material_id": None,
        "matched_description": None,
        "confidence": 0.0,
        "match_reason": "No similar material found in the master.",
        "cnmc": None,
    }

    if not candidates:
        # Insert a new_material queue entry
        _insert_queue(supabase, incoming_description, incoming_specs, None, None,
                      "new_material", 0.0, 0.0, best_result["match_reason"], gr_line_item_id)
        return best_result

    # Evaluate top candidates with Gemini
    best_candidate = None
    best_confidence = 0.0
    best_gemini = {}
    best_sim = 0.0

    for candidate in candidates:
        sim = candidate.get("similarity", 0.0)
        # Fast-path: if similarity below near threshold, skip Gemini call
        if sim < NEAR_THRESHOLD:
            continue

        gemini_out = await _call_gemini_matcher(
            desc_a=candidate.get("standard_description", ""),
            cnmc_a=candidate.get("cnmc", ""),
            specs_a=str(candidate.get("spec", "")),
            desc_b=incoming_description,
            specs_b=str(incoming_specs or ""),
        )
        conf = float(gemini_out.get("confidence", 0.0))
        if conf > best_confidence:
            best_confidence = conf
            best_candidate = candidate
            best_gemini = gemini_out
            best_sim = sim

    if best_candidate:
        match_type = best_gemini.get("match_type", "different")
        match_status = _map_to_match_status(match_type, best_confidence)
        reason = best_gemini.get("reason", "")

        _insert_queue(
            supabase,
            incoming_description,
            incoming_specs,
            best_candidate["id"],
            match_type,
            match_status,
            best_confidence,
            best_sim,
            reason,
            gr_line_item_id,
        )

        best_result = {
            "match_status": match_status,
            "matched_material_id": best_candidate["id"],
            "matched_description": best_candidate.get("standard_description"),
            "confidence": best_confidence,
            "match_reason": reason,
            "cnmc": best_candidate.get("cnmc"),
        }
    else:
        _insert_queue(supabase, incoming_description, incoming_specs, None, None,
                      "new_material", 0.0, 0.0, "No candidate above similarity threshold.", gr_line_item_id)

    return best_result


def _insert_queue(
    supabase: Client,
    desc: str,
    specs,
    candidate_id,
    match_type,
    match_status,
    confidence,
    similarity,
    reason,
    gr_line_item_id,
):
    row = {
        "incoming_description": desc,
        "incoming_specs": specs,
        "candidate_material_id": candidate_id,
        "match_type": match_type,
        "match_status": match_status if match_status in ("pending", "approved", "rejected") else "pending",
        "confidence_score": confidence,
        "similarity_score": similarity,
        "match_reason": reason,
        "gr_line_item_id": gr_line_item_id,
    }
    supabase.table("matching_queue").insert(row).execute()
