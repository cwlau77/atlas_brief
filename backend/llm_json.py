"""Parse JSON objects out of model replies (shared by planning, rerank and synthesis)."""
import json


def extract_json(raw_text: str) -> dict:
    """Pull a JSON object out of a model reply, tolerating ``` fences and stray prose.

    Raises ValueError when no parseable JSON object is present.
    """
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object found in model reply")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"model reply is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("model reply JSON is not an object")
    return data
