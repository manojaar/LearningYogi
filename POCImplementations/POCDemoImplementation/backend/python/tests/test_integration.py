"""Integration tests for full processing pipeline"""

import os
import sys
import pytest
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.preprocessor import ImagePreprocessor
from app.services.ocr_service import OCRService
from app.services.claude_service import ClaudeService
from app.models.ocr import TimetableData


@pytest.fixture
def sample_images():
    """Get paths to all sample timetable images"""
    base_path = Path(__file__).parent.parent.parent.parent
    sample_dir = base_path / "data" / "sample_timetables"
    
    images = []
    for ext in ['.png', '.jpeg', '.jpg']:
        images.extend(list(sample_dir.glob(f"*{ext}")))
    
    return images


@pytest.fixture
def temp_dir(tmp_path):
    """Temporary directory for processing outputs"""
    return str(tmp_path)


@pytest.mark.integration
class TestProcessingPipeline:
    """Integration tests for complete processing pipeline"""

    def test_end_to_end_preprocessing_to_ocr(self, sample_images, temp_dir):
        """Test complete preprocessing → OCR pipeline"""
        if not sample_images:
            pytest.skip("No sample images found")

        preprocessor = ImagePreprocessor()
        ocr_service = OCRService()

        for image_path in sample_images[:3]:  # Test first 3
            # 1. Preprocess
            enhanced_path = preprocessor.enhance_image(str(image_path), temp_dir)
            assert os.path.exists(enhanced_path)

            # 2. Run OCR
            ocr_result = ocr_service.process_image(enhanced_path)
            assert ocr_result is not None
            assert ocr_result.text is not None
            assert 0.0 <= ocr_result.confidence <= 1.0
            assert len(ocr_result.words) > 0

            # 3. Quality gate
            quality_gate = ocr_service.calculate_quality_gate(ocr_result)
            assert quality_gate.route in ['validation', 'ai']
            assert 0.0 <= quality_gate.confidence <= 1.0

    @pytest.mark.integration
    @pytest.mark.slow
    def test_end_to_end_with_claude_ai(self, sample_images, temp_dir):
        """Test complete pipeline including Claude AI"""
        if not os.environ.get("ANTHROPIC_API_KEY"):
            pytest.skip("ANTHROPIC_API_KEY not set")

        if not sample_images:
            pytest.skip("No sample images found")

        claude_service = ClaudeService()

        for image_path in sample_images[:2]:  # Test 2 images
            # Run AI extraction
            timetable = claude_service.extract_timetable(str(image_path))
            
            assert isinstance(timetable, TimetableData)
            assert timetable.timeblocks is not None
            assert len(timetable.timeblocks) > 0

            # Validate timeblock structure
            for block in timetable.timeblocks:
                assert block.day
                assert block.name
                assert block.startTime
                assert block.endTime
                # Verify time format
                assert len(block.startTime) == 5  # HH:MM
                assert block.startTime[2] == ':'
                assert len(block.endTime) == 5  # HH:MM
                assert block.endTime[2] == ':'

    def test_pipeline_with_low_quality_image(self, temp_dir):
        """Test pipeline handles low quality images gracefully"""
        # Create a synthetic low-quality test
        # For now, we'll test error handling
        pass

    def test_pipeline_error_recovery(self, sample_images, temp_dir):
        """Test pipeline handles errors gracefully"""
        if not sample_images:
            pytest.skip("No sample images found")

        preprocessor = ImagePreprocessor()
        ocr_service = OCRService()

        # Test with invalid image
        with pytest.raises(FileNotFoundError):
            preprocessor.enhance_image("/nonexistent/image.png", temp_dir)

        with pytest.raises(FileNotFoundError):
            ocr_service.process_image("/nonexistent/image.png")

