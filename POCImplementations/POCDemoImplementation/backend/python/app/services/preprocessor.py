"""
Image Preprocessing Service

Enhances images for better OCR accuracy using OpenCV.
Supports PDF conversion to images.
"""

import os
import uuid
import cv2
import numpy as np
from pathlib import Path
from typing import Optional

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False


class ImagePreprocessor:
    """
    Image preprocessing for OCR optimization
    """

    def enhance_image(self, image_path: str, output_dir: str) -> str:
        """
        Enhance image quality for better OCR results
        Supports PDF files (converts first page to image)

        Args:
            image_path: Path to input image or PDF
            output_dir: Directory to save enhanced image

        Returns:
            Path to enhanced image

        Raises:
            FileNotFoundError: If input image doesn't exist
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Create output directory if needed
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # Check if input is a PDF
        if image_path.lower().endswith('.pdf'):
            # Convert PDF to image first
            image_path = self._convert_pdf_to_image(image_path, output_dir)

        # Read image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")

        # 1. Grayscale conversion
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 2. Noise reduction
        denoised = cv2.fastNlMeansDenoising(gray, h=10)

        # 3. Adaptive thresholding for better text contrast
        # Use GAUSSIAN_C method for better results
        thresh = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2
        )

        # 4. Optional: Deskew (rotation correction)
        # For now, skip as it requires angle detection which is more complex
        # rotated = self._deskew_image(thresh)

        # Save preprocessed image
        output_filename = f"preprocessed_{uuid.uuid4()}.png"
        output_path = os.path.join(output_dir, output_filename)

        cv2.imwrite(output_path, thresh)

        return output_path

    def _deskew_image(self, image: np.ndarray) -> np.ndarray:
        """
        Correct image rotation/skew

        Args:
            image: Binary image

        Returns:
            Deskewed image
        """
        # This is a placeholder for future enhancement
        # Would use Hough Transform or Radon Transform to detect skew angle
        return image

    def _convert_pdf_to_image(self, pdf_path: str, output_dir: str) -> str:
        """
        Convert first page of PDF to image

        Args:
            pdf_path: Path to PDF file
            output_dir: Directory to save converted image

        Returns:
            Path to converted image

        Raises:
            ValueError: If PyMuPDF is not installed or PDF conversion fails
        """
        if not HAS_PYMUPDF:
            raise ValueError(
                "PDF support requires PyMuPDF. Install with: pip install PyMuPDF"
            )

        try:
            # Open PDF
            pdf_document = fitz.open(pdf_path)

            # Get first page
            page = pdf_document[0]

            # Render page to image (high resolution for better OCR)
            # zoom=2.0 means 2x resolution (144 DPI instead of 72 DPI)
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # Save as PNG
            output_filename = f"pdf_converted_{uuid.uuid4()}.png"
            output_path = os.path.join(output_dir, output_filename)
            pix.save(output_path)

            # Close PDF
            pdf_document.close()

            return output_path

        except Exception as e:
            raise ValueError(f"PDF conversion failed: {str(e)}")

