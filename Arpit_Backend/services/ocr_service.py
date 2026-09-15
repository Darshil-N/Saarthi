import json
import re
import uuid
import google.generativeai as genai
from config import settings
from supabase import Client

genai.configure(api_key=settings.GEMINI_API_KEY)

OCR_PROMPT = """
You are an expert OCR AI specialized in processing industrial goods receipts, invoices, and material inwards documents.
Your goal is to extract LINE ITEMS from the provided image and output them in a structured JSON array.

Analyze the image and return a JSON array containing one object for each line item found.
Do NOT wrap the output in markdown code blocks, just raw JSON.

Each object MUST have the following keys:
- line_id: String. A sequential ID or the line number from the receipt (e.g. "1").
- description: String. The full text description of the material.
- quantity: Number. The quantity received.
- unit: String. The unit of measure (e.g. "EA", "KG", "LTR", "MTR"). Default to "EA" if missing.
- unit_price: Number. The price per unit.
- total_price: Number. The total price for this line item.
- batch_number: String or null.
- hsn_code: String or null.
- quality_grade: String or null. Look for indications like "Grade A", "Standard", "Acceptable".
"""

async def run_ocr(file_bytes: bytes, mime_type: str = "image/jpeg") -> list:
    model = genai.GenerativeModel("gemini-1.5-flash")
    image_part = {
        "mime_type": mime_type,
        "data": file_bytes,
    }
    
    try:
        response = model.generate_content([OCR_PROMPT, image_part])
        raw_text = response.text.strip()
        raw_text = re.sub(r"^`(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*`$", "", raw_text)
        data = json.loads(raw_text)
        if isinstance(data, dict) and "line_items" in data:
            return data["line_items"]
        if isinstance(data, list):
            return data
        return []
    except Exception as e:
        print(f"OCR failed: {e}")
        return []

async def upload_bill_to_storage(supabase: Client, file_bytes: bytes, content_type: str) -> str:
    bucket = "receipts"
    ext = "pdf" if "pdf" in content_type else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    try:
        resp = supabase.storage.from_(bucket).upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": content_type}
        )
        return supabase.storage.from_(bucket).get_public_url(filename)
    except Exception as e:
        print(f"Storage upload failed: {e}")
        return ""
