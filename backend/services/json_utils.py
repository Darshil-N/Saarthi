import json
import re
from typing import Any

_FENCE_OPEN = re.compile(r"^\s*```[a-zA-Z0-9_-]*\s*")
_FENCE_CLOSE = re.compile(r"\s*```\s*$")


def extract_json(text: str) -> Any:
    """Parse the JSON value contained in an LLM reply.

    Handles bare JSON, JSON wrapped in ``` / ```json fences, and JSON surrounded by
    explanatory prose. Raises ValueError when no JSON value can be found.
    """
    if text is None:
        raise ValueError("Empty response")
    cleaned = _FENCE_CLOSE.sub("", _FENCE_OPEN.sub("", text.strip())).strip()
    if not cleaned:
        raise ValueError("Empty response")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()
    for match in re.finditer(r"[\[{]", cleaned):
        try:
            value, _ = decoder.raw_decode(cleaned[match.start():])
            return value
        except json.JSONDecodeError:
            continue
    raise ValueError("No JSON value found in response")
