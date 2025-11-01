"""
OCR Service - Tesseract OCR with confidence scoring

Test-Driven Development approach with sample timetables.
"""

import os
import re
import numpy as np
import pytesseract
from typing import List, Dict, Tuple

from app.models.ocr import OCRResult, OCRWord, QualityGateDecision


class OCRService:
    """
    OCR Processor with Tesseract and confidence scoring
    """

    # Quality gate threshold
    CONFIDENCE_THRESHOLD = 0.80

    def process_image(self, image_path: str) -> OCRResult:
        """
        Process image with Tesseract OCR

        Args:
            image_path: Path to preprocessed image

        Returns:
            OCRResult with extracted text and confidence

        Raises:
            FileNotFoundError: If image doesn't exist
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Run Tesseract OCR
        data = pytesseract.image_to_data(
            image_path,
            output_type=pytesseract.Output.DICT,
            config='--psm 6'  # Assume uniform block of text
        )

        # Extract words
        words = self._extract_words(data)
        full_text = ' '.join([w.text for w in words])

        # Calculate confidence
        confidence = self._calculate_confidence(data, full_text)

        return OCRResult(
            text=full_text,
            confidence=confidence,
            words=words,
            engine="tesseract"
        )

    def calculate_quality_gate(self, ocr_result: OCRResult) -> QualityGateDecision:
        """
        Determine routing based on OCR confidence

        Args:
            ocr_result: OCR processing result

        Returns:
            QualityGateDecision with route and reason
        """
        confidence = ocr_result.confidence

        if confidence >= self.CONFIDENCE_THRESHOLD:
            return QualityGateDecision(
                route='validation',
                confidence=confidence,
                reason=f'High confidence ({confidence:.2%}) - direct validation'
            )
        else:
            return QualityGateDecision(
                route='ai',
                confidence=confidence,
                reason=f'Medium confidence ({confidence:.2%}) - AI processing required'
            )

    def _extract_words(self, data: Dict) -> List[OCRWord]:
        """
        Extract words with confidence from Tesseract data

        Args:
            data: Tesseract output dictionary

        Returns:
            List of OCRWord objects
        """
        words = []
        n_boxes = len(data['text'])

        for i in range(n_boxes):
            conf = int(data['conf'][i])
            if conf > 0:  # Filter out low-confidence detections
                words.append(OCRWord(
                    text=data['text'][i],
                    confidence=float(conf) / 100.0,
                    left=data['left'][i],
                    top=data['top'][i],
                    width=data['width'][i],
                    height=data['height'][i]
                ))

        return words

    def _calculate_confidence(self, data: Dict, text: str) -> float:
        """
        Calculate overall confidence score

        Factors:
        1. Mean character confidence (40%)
        2. Word dictionary match rate (20%)
        3. Layout consistency (20%)
        4. Time pattern detection (20%)

        Args:
            data: Tesseract output dictionary
            text: Full extracted text

        Returns:
            Confidence score between 0 and 1
        """
        # Factor 1: Mean character confidence from Tesseract
        confidences = [float(c) / 100.0 for c in data['conf'] if int(c) > 0]
        mean_char_confidence = np.mean(confidences) if confidences else 0.0

        # Factor 2: Word dictionary match rate
        words = [w for w in data['text'] if w.strip()]
        dict_match_rate = self._calculate_dictionary_match(words)

        # Factor 3: Layout consistency
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

    def _calculate_dictionary_match(self, words: List[str]) -> float:
        """
        Calculate percentage of words that match common English words

        Args:
            words: List of extracted words

        Returns:
            Dictionary match rate between 0 and 1
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
            'reading', 'writing', 'phonics', 'spelling', 'class'
        }

        matches = sum(
            1 for word in words
            if word.lower() in timetable_vocab
        )

        return matches / len(words) if words else 0.0

    def _detect_layout_consistency(self, data: Dict) -> float:
        """
        Detect if OCR found consistent table/grid structure

        Args:
            data: Tesseract output dictionary

        Returns:
            Layout consistency score between 0 and 1
        """
        if not data['text']:
            return 0.0

        # Simple heuristic: check if we have reasonable structure
        # More words = better structure
        return 0.8 if len(data['text']) > 10 else 0.5

    def _detect_time_patterns(self, text: str) -> float:
        """
        Detect time patterns in text

        Args:
            text: Full extracted text

        Returns:
            Time pattern score between 0 and 1
        """
        # Time pattern regex
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

