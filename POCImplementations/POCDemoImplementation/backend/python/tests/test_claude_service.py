"""Tests for Claude AI service"""

import os
import sys
import re
import pytest
import json
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.claude_service import ClaudeService
from app.models.ocr import TimetableData, TimeBlock


@pytest.fixture
def claude_service():
    """Create a Claude service instance"""
    # Will skip if API key not available
    return ClaudeService()


@pytest.fixture
def sample_image_path():
    """Path to a sample timetable image"""
    base_path = Path(__file__).parent.parent.parent.parent
    test_image = base_path / "data" / "sample_timetables" / "Teacher Timetable Example 1.1.png"
    if test_image.exists():
        return str(test_image)
    else:
        pytest.skip("Sample timetable image not found")


@pytest.mark.unit
class TestClaudeService:
    """Unit tests for Claude service"""

    def test_init(self):
        """Test Claude service initialization"""
        # Should work even without API key for testing
        service = ClaudeService()
        assert service is not None

    def test_extract_timetable_returns_structured_data(self):
        """Test that extraction returns TimetableData"""
        service = ClaudeService()
        
        # Mock Claude API response
        mock_response = {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({
                        "teacher": "Mr. Smith",
                        "className": "Grade 5",
                        "term": "Term 1",
                        "year": 2024,
                        "timeblocks": [
                            {
                                "day": "Monday",
                                "name": "Mathematics",
                                "startTime": "09:00",
                                "endTime": "10:00",
                                "notes": None
                            }
                        ]
                    })
                }
            ]
        }
        
        with patch.object(service, '_call_claude_api', return_value=mock_response):
            with patch('pathlib.Path.exists', return_value=True):
                with patch('builtins.open', create=True):
                    result = service.extract_timetable("fake_path.png")
        
        assert isinstance(result, TimetableData)
        assert result.teacher == "Mr. Smith"
        assert result.className == "Grade 5"
        assert len(result.timeblocks) == 1

    def test_extract_timetable_validates_json_structure(self):
        """Test that extraction validates JSON structure"""
        service = ClaudeService()
        
        # Mock invalid JSON response
        mock_response = {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({
                        "invalid": "data"
                    })
                }
            ]
        }
        
        with patch.object(service, '_call_claude_api', return_value=mock_response):
            with patch('pathlib.Path.exists', return_value=True):
                with patch('builtins.open', create=True):
                    with pytest.raises(ValueError, match="timeblocks"):
                        service.extract_timetable("fake_path.png")

    def test_extract_timetable_handles_missing_fields(self):
        """Test that extraction handles missing optional fields"""
        service = ClaudeService()
        
        # Mock minimal valid response
        mock_response = {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({
                        "timeblocks": [
                            {
                                "day": "Monday",
                                "name": "Math",
                                "startTime": "09:00",
                                "endTime": "10:00"
                            }
                        ]
                    })
                }
            ]
        }
        
        with patch.object(service, '_call_claude_api', return_value=mock_response):
            with patch('pathlib.Path.exists', return_value=True):
                with patch('builtins.open', create=True):
                    result = service.extract_timetable("fake_path.png")
        
        assert result.teacher is None
        assert result.className is None
        assert len(result.timeblocks) == 1

    def test_extract_timetable_validates_time_format(self):
        """Test that extraction validates 24-hour time format"""
        service = ClaudeService()
        
        # Mock response with invalid time format
        mock_response = {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({
                        "timeblocks": [
                            {
                                "day": "Monday",
                                "name": "Math",
                                "startTime": "9am",  # Invalid format
                                "endTime": "10:00"
                            }
                        ]
                    })
                }
            ]
        }
        
        with patch.object(service, '_call_claude_api', return_value=mock_response):
            with patch('pathlib.Path.exists', return_value=True):
                with patch('builtins.open', create=True):
                    with pytest.raises(ValueError):
                        service.extract_timetable("fake_path.png")

    def test_extract_timetable_handles_api_errors(self):
        """Test that extraction handles API errors gracefully"""
        service = ClaudeService()
        
        # Mock API error
        with patch.object(service, '_call_claude_api', side_effect=Exception("API Error")):
            with patch('pathlib.Path.exists', return_value=True):
                with pytest.raises(Exception, match="API Error"):
                    service.extract_timetable("fake_path.png")

    def test_get_system_prompt_contains_rules(self):
        """Test that system prompt includes critical rules"""
        service = ClaudeService()
        prompt = service._get_system_prompt()
        
        assert "24-hour format" in prompt
        assert "timeblocks" in prompt
        assert "preserve" in prompt.lower()
        assert "json" in prompt.lower()

    @pytest.mark.integration
    @pytest.mark.skipif(
        not os.environ.get("ANTHROPIC_API_KEY"),
        reason="ANTHROPIC_API_KEY not set"
    )
    def test_extract_real_timetable(self, claude_service, sample_image_path):
        """Integration test with real Claude API and sample timetable"""
        result = claude_service.extract_timetable(sample_image_path)
        
        assert isinstance(result, TimetableData)
        assert len(result.timeblocks) > 0
        
        # Verify time format
        for block in result.timeblocks:
            assert re.match(r'^\d{2}:\d{2}$', block.startTime)
            assert re.match(r'^\d{2}:\d{2}$', block.endTime)

