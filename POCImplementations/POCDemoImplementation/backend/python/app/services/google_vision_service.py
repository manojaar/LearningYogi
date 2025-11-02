"""
Google Vision AI Service - Gemini and Vision API integration
"""

import os
import json
import base64
from pathlib import Path
from typing import Dict, Any, Optional

try:
    import google.generativeai as genai
    GOOGLE_AI_AVAILABLE = True
except ImportError:
    GOOGLE_AI_AVAILABLE = False

try:
    from google.cloud import vision
    VISION_API_AVAILABLE = True
except ImportError:
    VISION_API_AVAILABLE = False

from app.models.ocr import TimetableData


class GoogleVisionService:
    """
    Google Vision API integration for timetable extraction
    Supports Gemini Pro Vision and Google Cloud Vision API
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize Google Vision service with API key"""
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.model = model or "gemini-1.5-flash"  # Use latest stable model as default

        # Map model names to correct format for Gemini API
        # The API expects models in format: models/{model-name}
        # Valid models: gemini-1.5-flash, gemini-1.5-pro, gemini-1.5-pro-002, gemini-2.0-flash-exp
        model_mapping = {
            "gemini-pro-vision": "gemini-1.5-flash",  # Map deprecated to current
            "gemini-1.5-flash-latest": "gemini-1.5-flash",  # Remove -latest suffix
            "gemini-1.5-pro-latest": "gemini-1.5-pro",  # Remove -latest suffix
        }

        # Apply mapping if needed
        if self.model in model_mapping:
            original_model = self.model
            self.model = model_mapping[self.model]
            print(f"ℹ️  Model name mapped: {original_model} → {self.model}")

        # Ensure model name doesn't have "models/" prefix (SDK adds it)
        if self.model.startswith("models/"):
            self.model = self.model.replace("models/", "")

        # Initialize Gemini client if conditions are met
        if self.api_key and GOOGLE_AI_AVAILABLE and self.model.startswith("gemini"):
            try:
                genai.configure(api_key=self.api_key)
                self.gemini_client = genai.GenerativeModel(self.model)
                print(f"✓ Initialized Gemini client with model: {self.model}")
            except Exception as e:
                print(f"✗ Failed to initialize Gemini client: {str(e)}")
                self.gemini_client = None
        else:
            self.gemini_client = None
            if not self.api_key:
                print("✗ No Google API key provided")
            if not GOOGLE_AI_AVAILABLE:
                print("✗ Google AI SDK not available")

        if VISION_API_AVAILABLE:
            self.vision_client = vision.ImageAnnotatorClient()
        else:
            self.vision_client = None

    def set_api_key(self, api_key: str):
        """Update API key dynamically"""
        self.api_key = api_key
        if self.api_key and GOOGLE_AI_AVAILABLE and self.model.startswith("gemini"):
            genai.configure(api_key=self.api_key)
            self.gemini_client = genai.GenerativeModel(self.model)

    def set_model(self, model: str):
        """Update model dynamically"""
        self.model = model
        if self.api_key and GOOGLE_AI_AVAILABLE and self.model.startswith("gemini"):
            self.gemini_client = genai.GenerativeModel(self.model)

    def extract_timetable(self, image_path: str) -> TimetableData:
        """
        Extract structured timetable data using Google Vision

        Args:
            image_path: Path to timetable image

        Returns:
            TimetableData with extracted information
        """
        if not self.api_key:
            raise ValueError("Google API key not configured. Please provide a valid Google API key in the LLM settings.")

        if not GOOGLE_AI_AVAILABLE:
            raise ValueError("Google AI SDK not installed. Please install google-generativeai package.")

        if self.model.startswith("gemini"):
            if not self.gemini_client:
                raise ValueError(f"Gemini client not initialized. API key might be invalid or model '{self.model}' is not available. Please check your Google API key and try again.")
            return self._extract_with_gemini(image_path)
        elif self.model == "vision-api":
            if not self.vision_client:
                raise ValueError("Google Cloud Vision API client not available. Please ensure google-cloud-vision is installed and credentials are configured.")
            return self._extract_with_vision_api(image_path)
        else:
            raise ValueError(f"Unsupported model: {self.model}. Please select a supported Google model (gemini-pro-vision or vision-api).")

    def _extract_with_gemini(self, image_path: str) -> TimetableData:
        """Extract using Gemini Pro Vision"""
        # Read image and encode
        image_file = Path(image_path)
        if not image_file.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        print(f"📸 Processing image: {image_path}")
        print(f"   File size: {image_file.stat().st_size / 1024:.2f} KB")

        # Create prompt
        prompt = """Analyze this timetable image and extract structured data.
        Return a JSON object with the following structure:
        {
          "teacher": "teacher name or null",
          "className": "class name or null",
          "term": "term name or null",
          "year": year as number or null,
          "timeblocks": [
            {
              "day": "Monday",
              "name": "Subject name",
              "startTime": "09:00",
              "endTime": "10:30",
              "notes": "optional notes or null"
            }
          ]
        }
        Extract all time blocks visible in the timetable. Ensure times are in 24-hour format (HH:MM)."""

        try:
            # For Gemini, we need to pass the image as a PIL Image
            import PIL.Image

            # Try to open the image with PIL
            try:
                image = PIL.Image.open(image_path)
                print(f"   Format: {image.format}, Mode: {image.mode}, Size: {image.size}")

                # Convert images to RGB if they're in unsupported modes
                if image.mode not in ('RGB', 'RGBA', 'L'):
                    print(f"   Converting from {image.mode} to RGB...")
                    image = image.convert('RGB')

                # Gemini API supports: JPEG, PNG, WebP, HEIC, HEIF
                # If format is not supported, convert to JPEG
                supported_formats = ['JPEG', 'PNG', 'WEBP', 'HEIC', 'HEIF']
                if image.format and image.format.upper() not in supported_formats:
                    print(f"   ⚠️ Format {image.format} may not be supported, converting to JPEG...")
                    # Create a temporary JPEG file
                    temp_path = str(image_file).replace(image_file.suffix, '.gemini-temp.jpg')
                    image.save(temp_path, 'JPEG', quality=95)
                    image = PIL.Image.open(temp_path)
                    print(f"   ✓ Converted to JPEG: {temp_path}")

            except Exception as img_error:
                print(f"   ✗ Failed to open image with PIL: {str(img_error)}")
                raise ValueError(f"Failed to load image file. Format may be unsupported or file may be corrupted: {str(img_error)}")

            print(f"   ✓ Image loaded successfully, sending to Gemini API...")

            response = self.gemini_client.generate_content([prompt, image])

            # Parse response
            response_text = response.text
            print(f"   ✓ Received response from Gemini API")
            
            # Try to extract JSON from response
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                json_str = response_text[json_start:json_end].strip()
            elif '```' in response_text:
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                json_str = response_text[json_start:json_end].strip()
            else:
                json_str = response_text.strip()
            
            # Parse JSON
            data = json.loads(json_str)

            print(f"   ✓ Successfully parsed timetable data")
            print(f"   Found {len(data.get('timeblocks', []))} timeblocks")

            return TimetableData(
                teacher=data.get("teacher"),
                className=data.get("className"),
                term=data.get("term"),
                year=data.get("year"),
                timeblocks=data.get("timeblocks", [])
            )

        except json.JSONDecodeError as e:
            print(f"   ✗ Failed to parse JSON response: {str(e)}")
            print(f"   Response text: {response_text[:500]}...")
            raise ValueError(f"Gemini returned invalid JSON. The model may have failed to extract structured data from the image. Error: {str(e)}")
        except AttributeError as e:
            print(f"   ✗ Gemini API error: {str(e)}")
            raise ValueError(f"Gemini API error. The response may have been blocked or failed. Error: {str(e)}")
        except Exception as e:
            print(f"   ✗ Unexpected error: {str(e)}")
            raise ValueError(f"Failed to extract timetable with Gemini: {str(e)}")

    def _extract_with_vision_api(self, image_path: str) -> TimetableData:
        """Extract using Google Cloud Vision API"""
        # This would require Google Cloud Vision API setup
        # For now, raise NotImplementedError
        raise NotImplementedError("Google Cloud Vision API integration not yet implemented. Use Gemini Pro Vision instead.")

    async def extract_timetable_async(self, image_path: str) -> TimetableData:
        """Async version of extract_timetable"""
        # For now, call sync version
        return self.extract_timetable(image_path)

