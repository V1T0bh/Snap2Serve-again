import json
import re
from pathlib import Path
from typing import List

SYN_PATH = Path(__file__).parent / "synonyms.json"

def _load_synonyms() -> dict:
    if not SYN_PATH.exists():
        return {}
    return json.loads(SYN_PATH.read_text(encoding="utf-8"))

SYNONYMS = _load_synonyms()

STOP_WORDS = {
    "fresh", "organic", "chopped", "diced", "sliced", "minced",
    "raw", "cooked", "ripe", "large", "small"
}

def _simple_singularize(s: str) -> str:
    # Not perfect, but good enough for hackathon
    if s.endswith("ies") and len(s) > 4:
        return s[:-3] + "y"   # strawberries -> strawberry
    if s.endswith("es") and len(s) > 3:
        return s[:-2]         # tomatoes -> tomato (kinda)
    if s.endswith("s") and len(s) > 3:
        return s[:-1]         # eggs -> egg
    return s

def normalize_ingredients(raw: List[str]) -> List[str]:
    out = []
    seen = set()

    for item in raw:
        if not item:
            continue

        s = item.strip().lower()
        s = re.sub(r"[^a-z0-9\s-]", " ", s)   # remove punctuation
        s = re.sub(r"\s+", " ", s).strip()

        # remove stop words
        tokens = [t for t in s.split() if t not in STOP_WORDS]
        s = " ".join(tokens)

        if not s:
            continue

        s = _simple_singularize(s)

        # synonyms map (single term or phrase)
        s = SYNONYMS.get(s, s)

        if s not in seen:
            seen.add(s)
            out.append(s)

    return out
