import os
import json
import re
import uuid
import base64
import httpx
from typing import Optional
import google.generativeai as genai
from supabase import Client
from prompts.prompts import OCR_PROMPT
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)


async def upload_bill_to_storage(
    supabase: Client,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> str:
    """Upload bill image to Supabase Storage and return the public URL."""
    bucket = "bills"
    path = f"{uuid.uuid4()}/{filename}"
    supabase.storage.from_(bucket).upload(
        path,
        file_bytes,
        file_options={"content-type": content_type},
    )
    url_resp = supabase.storage.from_(bucket).get_public_url(path)
    return url_resp


async def run_ocr(
    file_bytes: bytes,
    content_type: str,
) -> list[dict]:
    """
    Send image bytes to Gemini Vision and parse the returned JSON array
    of line items.
    """
    model = genai.GenerativeModel("gemini-1.5-flash")

    # Encode image for Gemini inline data
    b64 = base64.b64encode(file_bytes).decode()
    image_part = {"inline_data": {"mime_type": content_type, "data": b64}}

    response = model.generate_content([OCR_PROMPT, image_part])
    raw = response.text.strip()

    # Strip markdown code fences if Gemini wraps output
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to extract first JSON array
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            items = json.loads(match.group())
        else:
            items = []

    return items if isinstance(items, list) else []
