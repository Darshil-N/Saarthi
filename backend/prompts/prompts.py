OCR_PROMPT = """You are a materials procurement assistant for an Indian public sector oil company.
Extract all line items from this bill/invoice image.
For each line item return: description, quantity, unit, unit_price, batch_number (if present, else null), hsn_code (if present, else null).
Return ONLY a JSON array. No explanation. No markdown."""

MATCHING_PROMPT = """You are a material deduplication expert for a national material master system.
Determine if these two materials are the same, similar, or different.
Material A (existing): description={desc_a}, cnmc={cnmc_a}, specs={specs_a}
Material B (incoming): description={desc_b}, specs={specs_b}
Classify as: exact / duplicate / near_duplicate / equivalent / different
Return ONLY JSON: {{"match_type": "...", "confidence": 0.0, "reason": "..."}}"""

CNMC_PROMPT = """You are a material classification expert for Indian public sector oil & gas companies.
Generate a CNMC (Codified National Material Code) in format: CATEGORY-SUBCATEGORY-TYPE-SPEC-QUALITY
Rules: each segment max 6 chars, uppercase, alphanumeric only.
Category tree:
  MECH: FSTNR, PIPE, VALVE, SEAL, BEAR
  ELEC: CABLE, PANEL, MOTOR, INSTRU
  CIVIL: STRUCT, CMENT, SAFETY
  CHEM: LUBR, SOLV, COAT
  CONS: PPE, TOOL, WELD

Material description: {description}
Technical specs: {specs}
Quality grade: {quality}

The "quality" field in your JSON output MUST be exactly one of: A, B, or C
(A = good/standard condition, B = fair, C = poor). This is also the CNMC's final
segment. If no quality signal is given, default to "A". Never put a spec code,
material grade, or anything other than a single letter A/B/C in this field.

Return ONLY JSON:
{{
  "cnmc": "...",
  "category": "...",
  "subcategory": "...",
  "type": "...",
  "spec": "...",
  "quality": "A|B|C",
  "standard_description": "...",
  "short_description": "..."
}}"""
