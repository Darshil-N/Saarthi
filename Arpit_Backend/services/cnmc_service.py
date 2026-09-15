import json
import re
import google.generativeai as genai
from supabase import Client
from config import settings
from prompts.prompts import CNMC_PROMPT

genai.configure(api_key=settings.GEMINI_API_KEY)

_CNMC_PATTERN = re.compile(r'^[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}$')


def _validate_cnmc(cnmc: str) -> bool:
    return bool(_CNMC_PATTERN.match(cnmc.upper()))


def _ensure_unique_cnmc(supabase: Client, cnmc: str) -> str:
    """Append numeric suffix (-2, -3, ...) until the CNMC is unique in materials table."""
    base = cnmc
    suffix = 2
    candidate = base
    while True:
        resp = supabase.table("materials").select("id").eq("cnmc", candidate).execute()
        if not resp.data:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


async def generate_cnmc(
    supabase: Client,
    description: str,
    specs: str = "",
    quality: str = "",
) -> dict:
    """
    Call Gemini to generate a CNMC for the given material description,
    validate the format, ensure uniqueness, and return the full classification dict.
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = CNMC_PROMPT.format(
        description=description,
        specs=specs or "not specified",
        quality=quality or "standard",
    )
    resp = model.generate_content(prompt)
    raw = resp.text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(match.group()) if match else {}

    cnmc = data.get("cnmc", "").upper()

    if not _validate_cnmc(cnmc):
        # Fallback: build a best-effort CNMC from category/subcategory
        cat = (data.get("category", "MISC") or "MISC")[:6].upper()
        sub = (data.get("subcategory", "GEN") or "GEN")[:6].upper()
        typ = (data.get("type", "GEN") or "GEN")[:6].upper()
        spc = (data.get("spec", "STD") or "STD")[:6].upper()
        qlt = (data.get("quality", "A") or "A")[:6].upper()
        cnmc = f"{cat}-{sub}-{typ}-{spc}-{qlt}"

    cnmc = _ensure_unique_cnmc(supabase, cnmc)
    data["cnmc"] = cnmc
    return data




