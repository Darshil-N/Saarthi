import json
import re
import google.generativeai as genai
from supabase import Client
from config import settings
from services.embedding_service import generate_embedding, find_similar_materials

genai.configure(api_key=settings.GEMINI_API_KEY)

EXACT_THRESHOLD = settings.SIMILARITY_EXACT
NEAR_THRESHOLD  = settings.SIMILARITY_NEAR

def _map_to_match_status(match_type: str, confidence: float) -> str:
    if match_type in ("exact", "duplicate") and confidence > 0.9:
        return "exact_match"
    if match_type in ("near_duplicate", "equivalent"):
        return "near_duplicate"
    if match_type == "different":
        return "new_material"
    return "uncertain"

async def _call_gemini_batch_matcher(incoming_desc: str, incoming_specs: dict, candidates: list) -> dict:
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    candidates_text = ""
    for idx, c in enumerate(candidates):
        candidates_text += f"\nCandidate {idx}:\nID: {c['id']}\nDescription: {c.get('standard_description')}\nCNMC: {c.get('cnmc')}\nSpecs: {c.get('spec')}\n---"

    prompt = f"""
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
    try:
        resp = model.generate_content(prompt)
        raw = resp.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print(f"Batch matching failed: {e}")
        return {"match_type": "different", "confidence": 0.0, "reason": "Batch parsing error"}

async def run_matching(
    supabase: Client,
    incoming_description: str,
    incoming_specs: dict | None = None,
    gr_line_item_id: str | None = None,
) -> dict:
    embedding = await generate_embedding(incoming_description)
    candidates = await find_similar_materials(supabase, embedding, top_k=5, threshold=0.70)

    best_result = {
        "match_status": "new_material",
        "matched_material_id": None,
        "matched_description": None,
        "match_type": "different",
        "confidence": 0.0,
        "vector_similarity": 0.0,
        "match_reason": "No similar material found in the master.",
        "cnmc": None,
        "embedding": embedding,
        "master_candidate": None
    }

    if not candidates:
        return best_result

    # Batch evaluate all candidates in 1 request
    gemini_out = await _call_gemini_batch_matcher(incoming_description, incoming_specs or {}, candidates)
    
    best_candidate_id = gemini_out.get("best_candidate_id")
    match_type = gemini_out.get("match_type", "different")
    confidence = float(gemini_out.get("confidence", 0.0))
    reason = gemini_out.get("reason", "")
    
    best_candidate = next((c for c in candidates if c["id"] == best_candidate_id), None)

    if best_candidate and match_type != "different":
        best_result = {
            "match_status": _map_to_match_status(match_type, confidence),
            "matched_material_id": best_candidate["id"],
            "matched_description": best_candidate.get("standard_description"),
            "match_type": match_type,
            "confidence": confidence,
            "vector_similarity": best_candidate.get("similarity", 0.0),
            "match_reason": reason,
            "cnmc": best_candidate.get("cnmc"),
            "embedding": embedding,
            "master_candidate": best_candidate
        }

    return best_result




