"""
OpenAI Vision Service - GPT-4 Vision integration
"""

import os
import json
import base64
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from openai import OpenAI, AsyncOpenAI
    from openai import APIError, APIConnectionError, RateLimitError, AuthenticationError
    OPENAI_AVAILABLE = True
except ImportError:
    OpenAI = None
    AsyncOpenAI = None
    APIError = None
    APIConnectionError = None
    RateLimitError = None
    AuthenticationError = None
    OPENAI_AVAILABLE = False

from app.models.ocr import TimetableData


class OpenAIVisionService:
    """
    OpenAI GPT-4 Vision API integration for timetable extraction
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize OpenAI Vision service with API key"""
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.model = model or "gpt-4o"  # Use latest model as default

        # Map deprecated model names to current ones
        model_mapping = {
            "gpt-4-vision-preview": "gpt-4o",  # Deprecated -> Current
        }

        # Apply mapping if needed
        if self.model in model_mapping:
            original_model = self.model
            self.model = model_mapping[self.model]
            print(f"ℹ️  Model name mapped: {original_model} → {self.model}")
        
        if self.api_key and OpenAI:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None
            
        # Async client for streaming
        if self.api_key and AsyncOpenAI:
            self.async_client = AsyncOpenAI(api_key=self.api_key)
        else:
            self.async_client = None

    def set_api_key(self, api_key: str):
        """Update API key dynamically"""
        self.api_key = api_key
        if self.api_key and OpenAI:
            self.client = OpenAI(api_key=self.api_key)
        if self.api_key and AsyncOpenAI:
            self.async_client = AsyncOpenAI(api_key=self.api_key)

    def set_model(self, model: str):
        """Update model dynamically"""
        self.model = model

    def extract_timetable(self, image_path: str) -> TimetableData:
        """
        Extract structured timetable data using GPT-4 Vision

        Args:
            image_path: Path to timetable image

        Returns:
            TimetableData with extracted information
        """
        print(f"🔑 OpenAI API Key: {'*' * 20}{self.api_key[-4:] if self.api_key and len(self.api_key) > 4 else 'NOT SET'}")
        print(f"📦 Model: {self.model}")

        if not self.api_key or not self.client:
            raise ValueError("OpenAI API key not configured. Provide api_key parameter or set OPENAI_API_KEY environment variable.")

        # Read image and encode
        image_file = Path(image_path)
        if not image_file.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        print(f"📸 Processing image: {image_path}")
        print(f"   File size: {image_file.stat().st_size / 1024:.2f} KB")
        
        image_data = image_file.read_bytes()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Determine image format
        image_ext = image_file.suffix.lower()
        if image_ext in ['.png']:
            image_type = 'image/png'
        elif image_ext in ['.jpg', '.jpeg']:
            image_type = 'image/jpeg'
        elif image_ext in ['.webp']:
            image_type = 'image/webp'
        else:
            image_type = 'image/jpeg'  # Default
        
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
        Extract all time blocks visible in the timetable. Ensure times are in 24-hour format (HH:MM).
        Return only the JSON object, no other text."""
        
        try:
            print(f"   ✓ Image loaded successfully, sending to OpenAI API...")
            print(f"   🔍 Request details:")
            print(f"      Model: {self.model}")
            print(f"      Image type: {image_type}")
            print(f"      Image size (base64): {len(image_base64)} characters")
            print(f"      Max tokens: 4096")
            print(f"      Temperature: 0.1")
            print(f"      API endpoint: chat.completions.create")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{image_type};base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4096,  # Increased from 2000 to handle larger timetables
                temperature=0.1
            )

            print(f"   ✓ Received response from OpenAI API")

            # Extract response
            response_text = response.choices[0].message.content

            # Log the response for debugging
            print(f"   📄 OpenAI Response (first 500 chars): {response_text[:500]}")
            print(f"   📄 Response length: {len(response_text)} characters")

            # Check if response was truncated
            if hasattr(response.choices[0], 'finish_reason'):
                print(f"   📄 Finish reason: {response.choices[0].finish_reason}")
                if response.choices[0].finish_reason == 'length':
                    print(f"   ⚠️  WARNING: Response was truncated due to max_tokens limit!")

            # Try to extract JSON from response
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                if json_end == -1:
                    # No closing backticks found - response might be truncated
                    print(f"   ⚠️  WARNING: No closing ``` found, using entire remaining text")
                    json_str = response_text[json_start:].strip()
                else:
                    json_str = response_text[json_start:json_end].strip()
            elif '```' in response_text:
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                if json_end == -1:
                    print(f"   ⚠️  WARNING: No closing ``` found, using entire remaining text")
                    json_str = response_text[json_start:].strip()
                else:
                    json_str = response_text[json_start:json_end].strip()
            else:
                json_str = response_text.strip()

            print(f"   📄 Extracted JSON (first 500 chars): {json_str[:500]}")
            print(f"   📄 Extracted JSON (last 200 chars): {json_str[-200:]}")

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
            print(f"   Response text: {response_text[:500] if 'response_text' in locals() else 'N/A'}...")
            raise ValueError(f"OpenAI returned invalid JSON. The model may have failed to extract structured data from the image. Error: {str(e)}")
        except Exception as e:
            print(f"   ✗ OpenAI API Error:")
            print(f"      Error type: {type(e).__name__}")
            print(f"      Error message: {str(e)}")

            # Try to extract detailed error information from OpenAI SDK exceptions
            error_details = {}

            # Check for OpenAI SDK error attributes
            if hasattr(e, 'status_code'):
                error_details['status_code'] = e.status_code
                print(f"      Status code: {e.status_code}")

            if hasattr(e, 'response'):
                error_details['response'] = str(e.response)
                print(f"      Response: {e.response}")

            if hasattr(e, 'body'):
                error_details['body'] = e.body
                print(f"      Body: {e.body}")

            if hasattr(e, 'message'):
                error_details['message'] = e.message
                print(f"      Message: {e.message}")

            if hasattr(e, 'code'):
                error_details['code'] = e.code
                print(f"      Code: {e.code}")

            # Print all error attributes for debugging
            print(f"      All error attributes: {dir(e)}")

            # Log the error details dict
            print(f"      Error details dict: {error_details}")

            # Re-raise with the original error message
            raise ValueError(f"Failed to extract timetable with OpenAI: {str(e)}")

    async def extract_timetable_async(self, image_path: str) -> TimetableData:
        """
        Async version of extract_timetable
        """
        if not self.api_key or not self.async_client:
            raise ValueError("OpenAI API key not configured.")
        
        # Read image and encode
        image_file = Path(image_path)
        if not image_file.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        image_data = image_file.read_bytes()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Determine image format
        image_ext = image_file.suffix.lower()
        if image_ext in ['.png']:
            image_type = 'image/png'
        elif image_ext in ['.jpg', '.jpeg']:
            image_type = 'image/jpeg'
        elif image_ext in ['.webp']:
            image_type = 'image/webp'
        else:
            image_type = 'image/jpeg'
        
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
        Extract all time blocks visible in the timetable. Ensure times are in 24-hour format (HH:MM).
        Return only the JSON object, no other text."""
        
        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{image_type};base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4096,  # Increased from 2000 to handle larger timetables
                temperature=0.1
            )

            response_text = response.choices[0].message.content

            # Log the response for debugging
            print(f"   📄 OpenAI Response (first 500 chars): {response_text[:500]}")
            print(f"   📄 Response length: {len(response_text)} characters")

            # Check if response was truncated
            if hasattr(response.choices[0], 'finish_reason'):
                print(f"   📄 Finish reason: {response.choices[0].finish_reason}")
                if response.choices[0].finish_reason == 'length':
                    print(f"   ⚠️  WARNING: Response was truncated due to max_tokens limit!")

            # Extract JSON
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                if json_end == -1:
                    # No closing backticks found - response might be truncated
                    print(f"   ⚠️  WARNING: No closing ``` found, using entire remaining text")
                    json_str = response_text[json_start:].strip()
                else:
                    json_str = response_text[json_start:json_end].strip()
            elif '```' in response_text:
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                if json_end == -1:
                    print(f"   ⚠️  WARNING: No closing ``` found, using entire remaining text")
                    json_str = response_text[json_start:].strip()
                else:
                    json_str = response_text[json_start:json_end].strip()
            else:
                json_str = response_text.strip()

            print(f"   📄 Extracted JSON (first 500 chars): {json_str[:500]}")
            print(f"   📄 Extracted JSON (last 200 chars): {json_str[-200:]}")

            data = json.loads(json_str)
            
            return TimetableData(
                teacher=data.get("teacher"),
                className=data.get("className"),
                term=data.get("term"),
                year=data.get("year"),
                timeblocks=data.get("timeblocks", [])
            )
            
        except Exception as e:
            raise ValueError(f"Failed to extract timetable with OpenAI: {str(e)}")

