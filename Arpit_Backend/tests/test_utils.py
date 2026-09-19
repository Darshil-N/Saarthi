from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from services.cnmc_service import _segment, _validate_cnmc
from services.json_utils import extract_json
from services.matching_service import _map_to_match_status, _parse_verdict, is_auto_link
from services.ocr_service import parse_ocr_items, to_number
from services.time_utils import business_day_start_utc
from services.validators import require_uuid


class TestExtractJson:
    def test_bare_json(self):
        assert extract_json('[{"a": 1}]') == [{"a": 1}]

    def test_json_fenced_with_language_tag(self):
        assert extract_json('```json\n[{"description": "Bolt"}]\n```') == [{"description": "Bolt"}]

    def test_json_fenced_without_language_tag(self):
        assert extract_json('```\n{"a": 1}\n```') == {"a": 1}

    def test_json_surrounded_by_prose(self):
        assert extract_json('Here are the items:\n[{"a": 1}]\nHope this helps!') == [{"a": 1}]

    @pytest.mark.parametrize("text", ["", "   ", "no json here at all", None])
    def test_no_json_raises(self, text):
        with pytest.raises(ValueError):
            extract_json(text)


class TestOcrParsing:
    @pytest.mark.parametrize("value,expected", [
        (5, 5.0), (2.5, 2.5), ("5", 5.0), ("1,200.50", 1200.5), ("₹ 120", 120.0),
        ("5 nos", 5.0), (None, None), ("n/a", None), (True, None), ("", None),
    ])
    def test_to_number(self, value, expected):
        assert to_number(value) == expected

    def test_items_are_normalised(self):
        items = parse_ocr_items([
            {"line_id": "1", "description": " Hex bolt ", "quantity": "5 nos", "unit": "ea",
             "unit_price": "₹12.50", "quality_grade": "b", "batch_number": "", "hsn_code": "7318"},
            {"line_id": "1", "description": "Nut", "quantity": 10, "unit_price": None, "total_price": 50},
        ])
        assert [i["line_id"] for i in items] == ["li_001", "li_002"]  # model's duplicate ids replaced
        assert items[0] == {
            "line_id": "li_001", "description": "Hex bolt", "quantity": 5.0, "unit": "EA",
            "unit_price": 12.5, "batch_number": None, "hsn_code": "7318", "quality_grade": "B",
        }
        assert items[1]["unit"] == "EA"          # defaulted
        assert items[1]["unit_price"] == 5.0     # derived from total / quantity

    def test_bad_rows_are_dropped_not_fatal(self):
        items = parse_ocr_items([{"description": ""}, "junk", None, {"description": "Valve", "quantity": None}])
        assert len(items) == 1 and items[0]["quantity"] == 0.0

    def test_dict_wrappers_are_unwrapped(self):
        assert len(parse_ocr_items({"line_items": [{"description": "A"}]})) == 1
        assert len(parse_ocr_items({"description": "Single item"})) == 1
        assert parse_ocr_items("nonsense") == []

    def test_negative_quantity_becomes_zero(self):
        assert parse_ocr_items([{"description": "A", "quantity": -3}])[0]["quantity"] == 0.0


class TestMatchingHelpers:
    def test_status_mapping(self):
        assert _map_to_match_status("exact", 0.95) == "exact_match"
        assert _map_to_match_status("exact", 0.5) == "uncertain"
        assert _map_to_match_status("near_duplicate", 0.8) == "near_duplicate"
        assert _map_to_match_status("different", 0.0) == "new_material"

    def test_auto_link_needs_exact_type_and_high_confidence(self):
        assert is_auto_link("exact", 0.96)
        assert not is_auto_link("exact", 0.95)          # threshold is strict (> 0.95)
        assert not is_auto_link("duplicate", 0.99)
        assert not is_auto_link("near_duplicate", 0.99)

    def test_verdict_parsing_validates(self):
        assert _parse_verdict({"best_candidate_id": "x", "match_type": "Exact", "confidence": 2, "reason": "r"}) == ("x", "exact", 1.0, "r")
        with pytest.raises(ValueError):
            _parse_verdict({"match_type": "maybe", "confidence": 0.5})
        with pytest.raises(ValueError):
            _parse_verdict({"match_type": "exact", "confidence": "high"})


class TestCnmcHelpers:
    def test_validate(self):
        assert _validate_cnmc("MECH-FSTNR-BOLT-M8X25-A")
        assert not _validate_cnmc("MECH-FSTNR-BOLT-M8X25")        # 4 segments
        assert not _validate_cnmc("MECH-FSTNR-BOLT-M8X25-TOOLONG1")

    def test_segment_sanitises(self):
        assert _segment("m8x25-ss304", "STD") == "M8X25S"
        assert _segment("!!!", "GEN") == "GEN"
        assert _segment(None, "GEN") == "GEN"


class TestBusinessDay:
    def test_ist_midnight_is_previous_day_1830_utc(self):
        now = datetime(2026, 9, 19, 3, 0, tzinfo=timezone.utc)  # 08:30 IST on the 19th
        assert business_day_start_utc(now) == datetime(2026, 9, 18, 18, 30, tzinfo=timezone.utc)

    def test_late_evening_utc_is_already_next_ist_day(self):
        now = datetime(2026, 9, 19, 20, 0, tzinfo=timezone.utc)  # 01:30 IST on the 20th
        assert business_day_start_utc(now) == datetime(2026, 9, 19, 18, 30, tzinfo=timezone.utc)


class TestRequireUuid:
    def test_valid_is_normalised(self):
        assert require_uuid("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA") == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    @pytest.mark.parametrize("bad", ["not-a-uuid", "", "123", None])
    def test_invalid_is_404(self, bad):
        with pytest.raises(HTTPException) as exc:
            require_uuid(bad, "Receipt")
        assert exc.value.status_code == 404 and exc.value.detail == "Receipt not found"
