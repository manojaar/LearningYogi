"""
OCR Processor - TDD Implementation

Handles OCR processing with multiple engines and confidence scoring.
Implements quality gates for routing to LLM or HITL.

Test-Driven Development approach:
1. Write tests first
2. Implement minimal code to pass
3. Refactor for quality
"""

import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re
import cv2
import numpy as np
import pytesseract
from google.cloud import vision

logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    """OCR processing result"""
    text: str
    confidence: float
    words: List[Dict[str, any]]
    timeblocks: Optional[List[Dict[str, str]]] = None
    engine: str = "tesseract"


@dataclass
class QualityGateDecision:
    """Quality gate routing decision"""
    route: str  # 'validation', 'llm', or 'hitl'
    confidence: float
    reason: str


class OCRProcessor:
    """
    OCR Processor with multi-engine support and quality gates
    """

    # Confidence thresholds for quality gates
    HIGH_CONFIDENCE_THRESHOLD = 0.98
    MEDIUM_CONFIDENCE_THRESHOLD = 0.80

    def __init__(self, use_cloud_vision: bool = False):
        """
        Initialize OCR processor

        Args:
            use_cloud_vision: Enable Google Cloud Vision API (requires credentials)
        """
        self.use_cloud_vision = use_cloud_vision
        self.vision_client = vision.ImageAnnotatorClient() if use_cloud_vision else None

    def process_image(self, image_path: str) -> OCRResult:
        """
        Process image with Tesseract OCR

        Args:
            image_path: Path to preprocessed image

        Returns:
            OCRResult with extracted text and confidence

        Test: should extract text from clear timetable image
        Test: should handle low-quality images
        Test: should detect time patterns
        """
        logger.info(f"Processing image with Tesseract: {image_path}")

        # Read image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not read image: {image_path}")

        # Run Tesseract OCR
        data = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT,
            config='--psm 6'  # Assume uniform block of text
        )

        # Extract text and confidence
        words = self._extract_words(data)
        full_text = ' '.join([w['text'] for w in words])

        # Calculate confidence
        confidence = self._calculate_confidence(data, full_text)

        logger.info(f"OCR completed. Confidence: {confidence:.2%}")

        return OCRResult(
            text=full_text,
            confidence=confidence,
            words=words,
            engine="tesseract"
        )

    def process_with_cloud_vision(self, image_path: str) -> OCRResult:
        """
        Process image with Google Cloud Vision API

        Args:
            image_path: Path to image

        Returns:
            OCRResult with extracted text and confidence

        Test: should call Cloud Vision API
        Test: should handle API errors gracefully
        """
        if not self.use_cloud_vision:
            raise ValueError("Cloud Vision not enabled")

        logger.info(f"Processing image with Google Cloud Vision: {image_path}")

        # Read image
        with open(image_path, 'rb') as image_file:
            content = image_file.read()

        image = vision.Image(content=content)

        # Perform text detection
        response = self.vision_client.text_detection(image=image)
        texts = response.text_annotations

        if not texts:
            return OCRResult(
                text="",
                confidence=0.0,
                words=[],
                engine="google_cloud_vision"
            )

        # First annotation contains full text
        full_text = texts[0].description

        # Extract word-level data from remaining annotations
        words = []
        for text in texts[1:]:
            words.append({
                'text': text.description,
                'confidence': text.confidence if hasattr(text, 'confidence') else 1.0
            })

        confidence = self._calculate_confidence_from_words(words)

        logger.info(f"Cloud Vision OCR completed. Confidence: {confidence:.2%}")

        return OCRResult(
            text=full_text,
            confidence=confidence,
            words=words,
            engine="google_cloud_vision"
        )

    def calculate_quality_gate_decision(self, ocr_result: OCRResult) -> QualityGateDecision:
        """
        Determine routing based on OCR confidence

        Args:
            ocr_result: OCR processing result

        Returns:
            QualityGateDecision with route and reason

        Test: should route to validation if confidence >= 98%
        Test: should route to LLM if 80% <= confidence < 98%
        Test: should route to HITL if confidence < 80%
        """
        confidence = ocr_result.confidence

        if confidence >= self.HIGH_CONFIDENCE_THRESHOLD:
            return QualityGateDecision(
                route='validation',
                confidence=confidence,
                reason=f'High confidence ({confidence:.2%}) - direct validation'
            )
        elif confidence >= self.MEDIUM_CONFIDENCE_THRESHOLD:
            return QualityGateDecision(
                route='llm',
                confidence=confidence,
                reason=f'Medium confidence ({confidence:.2%}) - LLM processing required'
            )
        else:
            return QualityGateDecision(
                route='hitl',
                confidence=confidence,
                reason=f'Low confidence ({confidence:.2%}) - human review required'
            )

    def extract_timeblocks(self, text: str) -> List[Dict[str, str]]:
        """
        Extract timetable blocks from OCR text

        Args:
            text: Full OCR text

        Returns:
            List of timeblocks with day, name, times

        Test: should extract timeblocks with times
        Test: should handle different time formats
        Test: should preserve event names exactly
        """
        timeblocks = []

        # Time pattern regex (handles multiple formats)
        # Examples: 9:00, 09:00, 9.00, 9am, 9:00am, 9:00 AM
        time_pattern = r'(\d{1,2})[:.:]?(\d{2})?\s*(am|pm|AM|PM)?'

        # Split text into lines
        lines = text.strip().split('\n')

        current_day = None
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if line is a day of week
            day_match = re.search(
                r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
                line,
                re.IGNORECASE
            )
            if day_match:
                current_day = day_match.group(1).capitalize()
                continue

            # Extract times from line
            times = re.findall(time_pattern, line, re.IGNORECASE)
            if times and current_day:
                # Extract event name (remove times from line)
                event_name = re.sub(time_pattern, '', line, flags=re.IGNORECASE).strip()

                if event_name:
                    # Normalize times
                    start_time = self._normalize_time(times[0]) if len(times) > 0 else None
                    end_time = self._normalize_time(times[1]) if len(times) > 1 else None

                    timeblocks.append({
                        'day': current_day,
                        'name': event_name,
                        'startTime': start_time,
                        'endTime': end_time
                    })

        return timeblocks

    # Private helper methods

    def _extract_words(self, data: Dict) -> List[Dict[str, any]]:
        """Extract words with confidence from Tesseract data"""
        words = []
        n_boxes = len(data['text'])

        for i in range(n_boxes):
            if int(data['conf'][i]) > 0:  # Filter out low-confidence detections
                words.append({
                    'text': data['text'][i],
                    'confidence': float(data['conf'][i]) / 100.0,
                    'left': data['left'][i],
                    'top': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i]
                })

        return words

    def _calculate_confidence(self, data: Dict, text: str) -> float:
        """
        Calculate overall confidence score

        Factors:
        1. Mean character confidence (40%)
        2. Word dictionary match rate (20%)
        3. Layout consistency (20%)
        4. Time pattern detection (20%)

        Test: should calculate confidence correctly
        Test: should weight factors appropriately
        """
        # Factor 1: Mean character confidence from Tesseract
        confidences = [float(c) / 100.0 for c in data['conf'] if int(c) > 0]
        mean_char_confidence = np.mean(confidences) if confidences else 0.0

        # Factor 2: Word dictionary match rate
        words = [w for w in data['text'] if w.strip()]
        dict_match_rate = self._calculate_dictionary_match(words)

        # Factor 3: Layout consistency (check if table structure detected)
        layout_score = self._detect_layout_consistency(data)

        # Factor 4: Time pattern detection
        time_pattern_score = self._detect_time_patterns(text)

        # Weighted average
        weights = {
            'char_confidence': 0.4,
            'dict_match': 0.2,
            'layout': 0.2,
            'time_patterns': 0.2
        }

        confidence = (
            weights['char_confidence'] * mean_char_confidence +
            weights['dict_match'] * dict_match_rate +
            weights['layout'] * layout_score +
            weights['time_patterns'] * time_pattern_score
        )

        return min(confidence, 1.0)  # Cap at 100%

    def _calculate_confidence_from_words(self, words: List[Dict]) -> float:
        """Calculate confidence from word-level data"""
        if not words:
            return 0.0

        confidences = [w['confidence'] for w in words if 'confidence' in w]
        return np.mean(confidences) if confidences else 0.9  # Default for Cloud Vision

    def _calculate_dictionary_match(self, words: List[str]) -> float:
        """
        Calculate percentage of words that match common English words

        Test: should identify common timetable words
        """
        if not words:
            return 0.0

        # Common timetable vocabulary
        timetable_vocab = {
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
            'saturday', 'sunday',
            'maths', 'english', 'science', 'history', 'geography',
            'art', 'music', 'pe', 'physical', 'education',
            'assembly', 'registration', 'break', 'lunch', 'recess',
            'reading', 'writing', 'phonics', 'spelling'
        }

        matches = sum(
            1 for word in words
            if word.lower() in timetable_vocab
        )

        return matches / len(words) if words else 0.0

    def _detect_layout_consistency(self, data: Dict) -> float:
        """
        Detect if OCR found consistent table/grid structure

        Test: should detect grid patterns
        """
        if not data['text']:
            return 0.0

        # Simple heuristic: check if text boxes are aligned
        # More sophisticated: Use line detection with OpenCV

        # For now, return moderate score if we have reasonable structure
        return 0.8 if len(data['text']) > 10 else 0.5

    def _detect_time_patterns(self, text: str) -> float:
        """
        Detect time patterns in text

        Test: should find time patterns
        Test: should handle multiple time formats
        """
        time_pattern = r'\b(\d{1,2})[:.:]?(\d{2})?\s*(am|pm|AM|PM)?\b'
        matches = re.findall(time_pattern, text)

        # Score based on number of time patterns found
        # Expect at least 5 time entries in a typical timetable
        if len(matches) >= 5:
            return 1.0
        elif len(matches) >= 3:
            return 0.8
        elif len(matches) >= 1:
            return 0.6
        else:
            return 0.0

    def _normalize_time(self, time_tuple: Tuple) -> str:
        """
        Normalize time to HH:MM 24-hour format

        Args:
            time_tuple: (hour, minute, am/pm) from regex

        Returns:
            Normalized time string

        Test: should convert 9am to 09:00
        Test: should convert 2:30pm to 14:30
        Test: should handle missing minutes
        """
        hour_str, minute_str, meridiem = time_tuple

        hour = int(hour_str)
        minute = int(minute_str) if minute_str else 0

        # Convert 12-hour to 24-hour
        if meridiem:
            meridiem = meridiem.upper()
            if meridiem == 'PM' and hour != 12:
                hour += 12
            elif meridiem == 'AM' and hour == 12:
                hour = 0

        return f"{hour:02d}:{minute:02d}"
