import asyncio
import logging
import re
import uuid

from supabase import Client

from config import settings
from prompts.prompts import CNMC_PROMPT
from services.ai_common import AIServiceError, generate_text
from services.json_utils import extract_json

logger = logging.getLogger(__name__)

_CNMC_PATTERN = re.compile(r"^[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}$")
_MAX_SUFFIX_ATTEMPTS = 100


def _validate_cnmc(cnmc: str) -> bool:
    return bool(_CNMC_PATTERN.match(cnmc.upper()))


def _segment(value, default: str) -> str:
    """Uppercase, alphanumeric-only, at most 6 characters; `default` when nothing usable remains."""
    cleaned = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())[:6]
    return cleaned or default


def _ensure_unique_cnmc(supabase: Client, cnmc: str) -> str:
    """Append a numeric suffix (-2, -3, ...) until the CNMC is unused in the materials table."""
    candidate = cnmc
    for suffix in range(2, _MAX_SUFFIX_ATTEMPTS + 2):
        if not supabase.table("materials").select("id").eq("cnmc", candidate).limit(1).execute().data:
            return candidate
        candidate = f"{cnmc}-{suffix}"
    return f"{cnmc}-{uuid.uuid4().hex[:6].upper()}"


def _fallback_classification(description: str) -> dict:
    """Deterministic classification used when the AI service cannot provide one."""
    return {
        "category": "MISC",
        "subcategory": "GEN",
        "type": "GEN",
        "spec": "STD",
        "quality": "A",
        "standard_description": description,
        "short_description": description[:60],
        "fallback": True,
    }


async def generate_cnmc(
    supabase: Client,
    description: str,
    specs: str = "",
    quality: str = "",
) -> dict:
    """
    Ask Gemini to classify the material and propose a CNMC, validate the format and make it
    unique. If the AI service is unavailable or answers with garbage, a deterministic MISC-GEN
    classification is returned (flagged with "fallback": True) so intake never fails because of it.
    """
    prompt = CNMC_PROMPT.format(
        description=description,
        specs=specs or "not specified",
        quality=quality or "standard",
    )
    try:
        data = extract_json(await generate_text(settings.GEMINI_MODEL_CNMC, prompt))
        if not isinstance(data, dict):
            raise ValueError("CNMC reply was not a JSON object")
    except (AIServiceError, ValueError) as exc:
        logger.warning("CNMC generation fell back to defaults for %r: %s", description[:80], exc)
        data = _fallback_classification(description)

    data["category"] = _segment(data.get("category"), "MISC")
    data["subcategory"] = _segment(data.get("subcategory"), "GEN")
    data["type"] = _segment(data.get("type"), "GEN")
    data["spec"] = str(data.get("spec") or "STD")
    data["quality"] = str(data.get("quality") or "A").strip().upper()
    if data["quality"] not in ("A", "B", "C"):
        data["quality"] = "A"
    data["standard_description"] = str(data.get("standard_description") or description)
    data["short_description"] = str(data.get("short_description") or description[:60])

    proposed = str(data.get("cnmc") or "").strip().upper()
    if not _validate_cnmc(proposed):
        proposed = "-".join([
            data["category"],
            data["subcategory"],
            data["type"],
            _segment(data["spec"], "STD"),
            data["quality"],
        ])

    data["cnmc"] = await asyncio.to_thread(_ensure_unique_cnmc, supabase, proposed)
    return data
