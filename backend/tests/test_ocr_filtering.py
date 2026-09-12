import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ocr import looks_like_plate


def test_typical_plate_with_hyphen_is_accepted():
    assert looks_like_plate("ABC-1234") is True


def test_typical_plate_with_space_is_accepted():
    assert looks_like_plate("LEA 4477") is True


def test_lowercase_plate_is_still_accepted():
    # OCR sometimes reads lowercase; looks_like_plate should normalize this itself
    assert looks_like_plate("lea-4477") is True


def test_plain_word_with_no_digits_is_rejected():
    assert looks_like_plate("CERTIFIED") is False


def test_long_sticker_text_is_rejected():
    assert looks_like_plate("CERTIFIED PRE-OWNED") is False


def test_pure_number_with_no_letters_is_rejected():
    # e.g. a price tag or odometer reading, not a plate (for regions
    # where plates always mix letters and numbers)
    assert looks_like_plate("19999") is False


def test_too_short_string_is_rejected():
    assert looks_like_plate("A1") is False


def test_empty_string_is_rejected():
    assert looks_like_plate("") is False
