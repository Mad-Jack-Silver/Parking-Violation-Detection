import re
from typing import Optional, Tuple

import numpy as np

_reader = None

_PLATE_SHAPE_RE = re.compile(r"^[A-Z0-9\- ]{4,10}$")
_MIN_PLATE_CHARS = 4
_MAX_PLATE_CHARS = 8


def get_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr
            _reader = easyocr.Reader(["en"], gpu=False)
        except Exception as e:
            print("OCR init note:", e)
            _reader = False
    return _reader if _reader is not False else None


def looks_like_plate(text: str) -> bool:
    cleaned = text.strip().upper()
    if not _PLATE_SHAPE_RE.match(cleaned):
        return False
    alnum_only = re.sub(r"[\-\s]", "", cleaned)
    if not (_MIN_PLATE_CHARS <= len(alnum_only) <= _MAX_PLATE_CHARS):
        return False
    has_letter = any(c.isalpha() for c in alnum_only)
    has_digit = any(c.isdigit() for c in alnum_only)
    return has_letter and has_digit


def read_plate_text(crop: np.ndarray) -> Tuple[Optional[str], Optional[float]]:
    reader = get_reader()
    if not reader:
        return None, None
    try:
        results = reader.readtext(crop)
        plate_candidates = [r for r in results if looks_like_plate(r[1])]
        if not plate_candidates:
            return None, None

        best = max(plate_candidates, key=lambda r: r[2])
        text = best[1].strip().upper()
        confidence = float(best[2])
        return text, confidence
    except Exception as e:
        print("OCR read error:", e)
        return None, None
