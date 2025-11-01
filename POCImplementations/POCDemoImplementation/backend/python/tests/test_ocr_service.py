"""Tests for OCR service"""

import os
import sys
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ocr_service import OCRService
from app.models.ocr import QualityGateDecision


@pytest.fixture
def ocr_service():
    """Create an OCR service instance"""
    return OCRService()


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
class TestOCRService:
    """Unit tests for OCR service"""

    def test_init(self, ocr_service):
        """Test OCR service initialization"""
        assert ocr_service is not None
        assert isinstance(ocr_service, OCRService)

    def test_process_image_returns_result(self, ocr_service, sample_image_path):
        """Test that OCR processing returns a result"""
        result = ocr_service.process_image(sample_image_path)
        
        assert result is not None
        assert hasattr(result, 'text')
        assert hasattr(result, 'confidence')
        assert hasattr(result, 'words')
        assert hasattr(result, 'engine')

    def test_process_image_extracts_text(self, ocr_service, sample_image_path):
        """Test that OCR extracts some text"""
        result = ocr_service.process_image(sample_image_path)
        
        assert isinstance(result.text, str)
        # Should extract at least some text from timetable
        assert len(result.text) > 0

    def test_process_image_has_words(self, ocr_service, sample_image_path):
        """Test that OCR result contains word data"""
        result = ocr_service.process_image(sample_image_path)
        
        assert isinstance(result.words, list)
        # Should have at least some words detected
        assert len(result.words) > 0

    def test_process_image_word_structure(self, ocr_service, sample_image_path):
        """Test that word objects have correct structure"""
        result = ocr_service.process_image(sample_image_path)
        
        for word in result.words:
            assert hasattr(word, 'text')
            assert hasattr(word, 'confidence')
            assert hasattr(word, 'left')
            assert hasattr(word, 'top')
            assert hasattr(word, 'width')
            assert hasattr(word, 'height')
            
            # Confidence should be between 0 and 1
            assert 0.0 <= word.confidence <= 1.0

    def test_process_image_confidence_range(self, ocr_service, sample_image_path):
        """Test that confidence is in valid range"""
        result = ocr_service.process_image(sample_image_path)
        
        assert 0.0 <= result.confidence <= 1.0

    def test_process_image_invalid_path(self, ocr_service):
        """Test error handling for invalid image path"""
        with pytest.raises(FileNotFoundError):
            ocr_service.process_image("/nonexistent/image.png")

    def test_calculate_quality_gate_high_confidence(self, ocr_service):
        """Test quality gate routing for high confidence"""
        # Mock OCR result with high confidence
        class MockResult:
            confidence = 0.95
        
        decision = ocr_service.calculate_quality_gate(MockResult())
        
        assert isinstance(decision, QualityGateDecision)
        assert decision.route == 'validation'
        assert decision.confidence == 0.95
        assert 'high' in decision.reason.lower()

    def test_calculate_quality_gate_medium_confidence(self, ocr_service):
        """Test quality gate routing for medium confidence"""
        # Mock OCR result with medium confidence
        class MockResult:
            confidence = 0.75
        
        decision = ocr_service.calculate_quality_gate(MockResult())
        
        assert isinstance(decision, QualityGateDecision)
        assert decision.route == 'ai'
        assert decision.confidence == 0.75
        assert 'medium' in decision.reason.lower() or 'ai' in decision.reason.lower()

    def test_calculate_quality_gate_low_confidence(self, ocr_service):
        """Test quality gate routing for low confidence"""
        # Mock OCR result with low confidence
        class MockResult:
            confidence = 0.50
        
        decision = ocr_service.calculate_quality_gate(MockResult())
        
        assert isinstance(decision, QualityGateDecision)
        assert decision.route == 'ai'  # Below 80% goes to AI
        assert decision.confidence == 0.50

    def test_quality_gate_threshold_80(self, ocr_service):
        """Test that quality gate threshold is 80%"""
        # Test exactly at 80%
        class MockResult:
            confidence = 0.80
        
        decision = ocr_service.calculate_quality_gate(MockResult())
        
        assert decision.route == 'ai'  # 80% is below threshold, goes to AI

    def test_quality_gate_threshold_above_80(self, ocr_service):
        """Test that quality gate above 80% goes to validation"""
        # Test just above 80%
        class MockResult:
            confidence = 0.81
        
        decision = ocr_service.calculate_quality_gate(MockResult())
        
        assert decision.route == 'validation'

    @pytest.mark.slow
    def test_process_real_timetable(self, ocr_service):
        """Integration test with real timetable images"""
        base_path = Path(__file__).parent.parent.parent.parent
        sample_dir = base_path / "data" / "sample_timetables"
        
        # Test all PNG samples
        test_images = list(sample_dir.glob("*.png"))
        test_images.extend(list(sample_dir.glob("*.jpeg")))
        
        for image_path in test_images[:3]:  # Limit to 3 for speed
            result = ocr_service.process_image(str(image_path))
            
            assert result is not None
            assert len(result.text) > 0
            assert 0.0 <= result.confidence <= 1.0

