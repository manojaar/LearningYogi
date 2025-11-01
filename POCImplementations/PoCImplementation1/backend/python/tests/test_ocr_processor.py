"""
OCR Processor Test Suite - TDD Approach

Test-Driven Development:
1. Write test first (defines expected behavior)
2. Implement minimal code to pass
3. Refactor for quality

Coverage Target: 85%+
"""

import pytest
import numpy as np
from unittest.mock import Mock, patch, mock_open
from src.ocr.processor import OCRProcessor, OCRResult, QualityGateDecision


class TestOCRProcessor:
    """Test suite for OCR Processor"""

    @pytest.fixture
    def processor(self):
        """Create OCR processor instance"""
        return OCRProcessor(use_cloud_vision=False)

    @pytest.fixture
    def processor_with_cloud_vision(self):
        """Create OCR processor with Cloud Vision enabled"""
        with patch('src.ocr.processor.vision.ImageAnnotatorClient'):
            return OCRProcessor(use_cloud_vision=True)

    @pytest.fixture
    def mock_tesseract_data(self):
        """Mock Tesseract OCR output data"""
        return {
            'text': ['Monday', '', '9:00', 'Maths', '', '10:00', 'English'],
            'conf': ['95', '-1', '98', '92', '-1', '97', '90'],
            'left': [10, 20, 30, 40, 50, 60, 70],
            'top': [10, 20, 30, 40, 50, 60, 70],
            'width': [50, 50, 50, 50, 50, 50, 50],
            'height': [20, 20, 20, 20, 20, 20, 20]
        }

    def test_process_image_success(self, processor, mock_tesseract_data):
        """
        Test: should successfully process image with Tesseract
        """
        # Arrange
        test_image_path = '/tmp/test_timetable.png'

        # Mock cv2.imread
        with patch('cv2.imread') as mock_imread, \
             patch('pytesseract.image_to_data') as mock_ocr:

            mock_imread.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
            mock_ocr.return_value = mock_tesseract_data

            # Act
            result = processor.process_image(test_image_path)

            # Assert
            assert isinstance(result, OCRResult)
            assert result.engine == 'tesseract'
            assert result.confidence > 0.0
            assert result.confidence <= 1.0
            assert len(result.words) > 0
            assert 'Monday' in result.text or 'Maths' in result.text

            # Verify mock calls
            mock_imread.assert_called_once_with(test_image_path)
            mock_ocr.assert_called_once()

    def test_process_image_invalid_path(self, processor):
        """
        Test: should raise ValueError for invalid image path
        """
        # Arrange
        invalid_path = '/nonexistent/image.png'

        with patch('cv2.imread', return_value=None):
            # Act & Assert
            with pytest.raises(ValueError, match="Could not read image"):
                processor.process_image(invalid_path)

    def test_calculate_quality_gate_high_confidence(self, processor):
        """
        Test: should route to validation if confidence >= 98%
        """
        # Arrange
        high_confidence_result = OCRResult(
            text="Sample text",
            confidence=0.99,
            words=[],
            engine="tesseract"
        )

        # Act
        decision = processor.calculate_quality_gate_decision(high_confidence_result)

        # Assert
        assert isinstance(decision, QualityGateDecision)
        assert decision.route == 'validation'
        assert decision.confidence == 0.99
        assert 'High confidence' in decision.reason

    def test_calculate_quality_gate_medium_confidence(self, processor):
        """
        Test: should route to LLM if 80% <= confidence < 98%
        """
        # Arrange
        medium_confidence_result = OCRResult(
            text="Sample text",
            confidence=0.85,
            words=[],
            engine="tesseract"
        )

        # Act
        decision = processor.calculate_quality_gate_decision(medium_confidence_result)

        # Assert
        assert decision.route == 'llm'
        assert decision.confidence == 0.85
        assert 'Medium confidence' in decision.reason
        assert 'LLM processing required' in decision.reason

    def test_calculate_quality_gate_low_confidence(self, processor):
        """
        Test: should route to HITL if confidence < 80%
        """
        # Arrange
        low_confidence_result = OCRResult(
            text="Sample text",
            confidence=0.65,
            words=[],
            engine="tesseract"
        )

        # Act
        decision = processor.calculate_quality_gate_decision(low_confidence_result)

        # Assert
        assert decision.route == 'hitl'
        assert decision.confidence == 0.65
        assert 'Low confidence' in decision.reason
        assert 'human review required' in decision.reason

    def test_extract_timeblocks_with_times(self, processor):
        """
        Test: should extract timeblocks with day, name, and times
        """
        # Arrange
        ocr_text = """
        Monday
        9:00 - 10:00 Maths
        10:00 - 11:00 English

        Tuesday
        9:00 - 10:00 Science
        """

        # Act
        timeblocks = processor.extract_timeblocks(ocr_text)

        # Assert
        assert len(timeblocks) >= 2
        assert any(tb['day'] == 'Monday' for tb in timeblocks)
        assert any(tb['name'] == 'Maths' for tb in timeblocks)
        assert any(tb['startTime'] == '09:00' for tb in timeblocks)

    def test_extract_timeblocks_preserves_event_names(self, processor):
        """
        Test: should preserve exact event names from OCR
        """
        # Arrange
        ocr_text = """
        Monday
        9:00 Physical Education & Games
        10:30 Anti-Bullying Week Assembly
        """

        # Act
        timeblocks = processor.extract_timeblocks(ocr_text)

        # Assert
        assert any('Physical Education' in tb['name'] for tb in timeblocks)
        assert any('Anti-Bullying' in tb['name'] for tb in timeblocks)

    def test_normalize_time_am_format(self, processor):
        """
        Test: should normalize 9am to 09:00
        """
        # Arrange
        time_tuple = ('9', None, 'am')

        # Act
        result = processor._normalize_time(time_tuple)

        # Assert
        assert result == '09:00'

    def test_normalize_time_pm_format(self, processor):
        """
        Test: should normalize 2:30pm to 14:30
        """
        # Arrange
        time_tuple = ('2', '30', 'pm')

        # Act
        result = processor._normalize_time(time_tuple)

        # Assert
        assert result == '14:30'

    def test_normalize_time_noon(self, processor):
        """
        Test: should handle 12pm (noon) correctly
        """
        # Arrange
        time_tuple = ('12', '00', 'pm')

        # Act
        result = processor._normalize_time(time_tuple)

        # Assert
        assert result == '12:00'  # Noon stays as 12

    def test_normalize_time_midnight(self, processor):
        """
        Test: should handle 12am (midnight) correctly
        """
        # Arrange
        time_tuple = ('12', '00', 'am')

        # Act
        result = processor._normalize_time(time_tuple)

        # Assert
        assert result == '00:00'  # Midnight becomes 00:00

    def test_normalize_time_24hour_format(self, processor):
        """
        Test: should handle 24-hour format without meridiem
        """
        # Arrange
        time_tuple = ('14', '30', None)

        # Act
        result = processor._normalize_time(time_tuple)

        # Assert
        assert result == '14:30'

    def test_calculate_confidence_high_quality(self, processor):
        """
        Test: should calculate high confidence for quality OCR data
        """
        # Arrange
        high_quality_data = {
            'text': ['Monday', 'Maths', 'English', 'Science', 'History'],
            'conf': ['98', '97', '99', '96', '98']
        }
        text = 'Monday Maths English Science History 9:00 10:00 11:00'

        # Act
        confidence = processor._calculate_confidence(high_quality_data, text)

        # Assert
        assert confidence >= 0.8  # Should be high
        assert confidence <= 1.0

    def test_calculate_confidence_low_quality(self, processor):
        """
        Test: should calculate low confidence for poor OCR data
        """
        # Arrange
        low_quality_data = {
            'text': ['abc', 'xyz', '123'],
            'conf': ['45', '50', '40']
        }
        text = 'abc xyz 123'

        # Act
        confidence = processor._calculate_confidence(low_quality_data, text)

        # Assert
        assert confidence < 0.7  # Should be lower

    def test_detect_time_patterns_multiple_times(self, processor):
        """
        Test: should detect multiple time patterns
        """
        # Arrange
        text = "9:00 Maths 10:00 English 11:00 Science 12:00 Lunch 1:00pm Art"

        # Act
        score = processor._detect_time_patterns(text)

        # Assert
        assert score == 1.0  # 5+ time patterns detected

    def test_detect_time_patterns_few_times(self, processor):
        """
        Test: should return moderate score for few time patterns
        """
        # Arrange
        text = "Monday 9:00 Maths English"

        # Act
        score = processor._detect_time_patterns(text)

        # Assert
        assert 0.5 <= score < 1.0  # Some patterns detected

    def test_detect_time_patterns_no_times(self, processor):
        """
        Test: should return zero score if no time patterns
        """
        # Arrange
        text = "Monday Tuesday Wednesday"

        # Act
        score = processor._detect_time_patterns(text)

        # Assert
        assert score == 0.0  # No time patterns

    def test_calculate_dictionary_match_timetable_vocab(self, processor):
        """
        Test: should recognize common timetable vocabulary
        """
        # Arrange
        words = ['Monday', 'Maths', 'English', 'Science', 'Assembly', 'Lunch']

        # Act
        match_rate = processor._calculate_dictionary_match(words)

        # Assert
        assert match_rate > 0.8  # Most words match timetable vocab

    def test_calculate_dictionary_match_random_words(self, processor):
        """
        Test: should have low match rate for random words
        """
        # Arrange
        words = ['abc', 'xyz', '123', 'random', 'words']

        # Act
        match_rate = processor._calculate_dictionary_match(words)

        # Assert
        assert match_rate < 0.3  # Few matches

    def test_extract_words_filters_low_confidence(self, processor, mock_tesseract_data):
        """
        Test: should filter out low-confidence detections
        """
        # Act
        words = processor._extract_words(mock_tesseract_data)

        # Assert
        # Should exclude entries with conf=-1
        assert len(words) == 5  # 7 total - 2 with conf=-1
        assert all(w['confidence'] > 0 for w in words)

    def test_extract_words_includes_positions(self, processor, mock_tesseract_data):
        """
        Test: should include word positions from Tesseract
        """
        # Act
        words = processor._extract_words(mock_tesseract_data)

        # Assert
        for word in words:
            assert 'left' in word
            assert 'top' in word
            assert 'width' in word
            assert 'height' in word
            assert isinstance(word['left'], int)

    @patch('src.ocr.processor.vision.ImageAnnotatorClient')
    def test_process_with_cloud_vision_success(self, mock_vision_client, processor_with_cloud_vision):
        """
        Test: should process image with Google Cloud Vision
        """
        # Arrange
        test_image_path = '/tmp/test.png'

        # Mock Cloud Vision response
        mock_annotation = Mock()
        mock_annotation.description = 'Monday 9:00 Maths 10:00 English'
        mock_annotation.confidence = 0.95

        mock_word1 = Mock()
        mock_word1.description = 'Monday'
        mock_word1.confidence = 0.96

        mock_word2 = Mock()
        mock_word2.description = '9:00'
        mock_word2.confidence = 0.94

        mock_response = Mock()
        mock_response.text_annotations = [mock_annotation, mock_word1, mock_word2]

        processor_with_cloud_vision.vision_client.text_detection = Mock(return_value=mock_response)

        # Mock file reading
        with patch('builtins.open', mock_open(read_data=b'fake image data')):
            # Act
            result = processor_with_cloud_vision.process_with_cloud_vision(test_image_path)

            # Assert
            assert isinstance(result, OCRResult)
            assert result.engine == 'google_cloud_vision'
            assert 'Monday' in result.text
            assert len(result.words) == 2  # Excludes first full-text annotation

    def test_process_with_cloud_vision_not_enabled(self, processor):
        """
        Test: should raise error if Cloud Vision not enabled
        """
        # Act & Assert
        with pytest.raises(ValueError, match="Cloud Vision not enabled"):
            processor.process_with_cloud_vision('/tmp/test.png')

    @patch('src.ocr.processor.vision.ImageAnnotatorClient')
    def test_process_with_cloud_vision_no_text_found(self, mock_vision_client, processor_with_cloud_vision):
        """
        Test: should return empty result if no text detected
        """
        # Arrange
        test_image_path = '/tmp/blank.png'

        mock_response = Mock()
        mock_response.text_annotations = []

        processor_with_cloud_vision.vision_client.text_detection = Mock(return_value=mock_response)

        with patch('builtins.open', mock_open(read_data=b'fake image data')):
            # Act
            result = processor_with_cloud_vision.process_with_cloud_vision(test_image_path)

            # Assert
            assert result.text == ""
            assert result.confidence == 0.0
            assert len(result.words) == 0


class TestOCRProcessorIntegration:
    """Integration tests requiring actual image processing"""

    @pytest.mark.integration
    def test_end_to_end_ocr_processing(self):
        """
        Integration test: Full OCR processing pipeline
        (Requires actual timetable image)
        """
        # This would use a real test image
        # pytest -m integration to run
        pass

    @pytest.mark.integration
    def test_quality_gate_with_real_images(self):
        """
        Integration test: Quality gate decisions with real timetables
        """
        pass


# Run tests with coverage:
# pytest --cov=src --cov-report=html tests/
#
# Run specific test:
# pytest tests/test_ocr_processor.py::TestOCRProcessor::test_process_image_success
#
# Run with verbose output:
# pytest -v tests/test_ocr_processor.py
