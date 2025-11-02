"""
Claude AI Service - Structured timetable extraction

Uses Anthropic Claude API with vision capabilities for extracting
structured timetable data from images.
"""

import os
import json
import base64
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from anthropic import Anthropic, AsyncAnthropic
except ImportError:
    Anthropic = None
    AsyncAnthropic = None

from app.models.ocr import TimetableData


class ClaudeService:
    """
    Claude Vision API integration for timetable extraction
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize Claude service with API key"""
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.model = model or "claude-3-opus-20240229"  # Claude 3 Opus - most capable vision model
        
        if self.api_key and Anthropic:
            self.client = Anthropic(api_key=self.api_key)
        else:
            self.client = None
            
        # Async client for streaming
        if self.api_key and AsyncAnthropic:
            self.async_client = AsyncAnthropic(api_key=self.api_key)
        else:
            self.async_client = None
    
    def set_api_key(self, api_key: str):
        """Update API key dynamically"""
        self.api_key = api_key
        if self.api_key and Anthropic:
            self.client = Anthropic(api_key=self.api_key)
        if self.api_key and AsyncAnthropic:
            self.async_client = AsyncAnthropic(api_key=self.api_key)
    
    def set_model(self, model: str):
        """Update model dynamically"""
        self.model = model

    def extract_timetable(self, image_path: str) -> TimetableData:
        """
        Extract structured timetable data using Claude Vision

        Args:
            image_path: Path to timetable image

        Returns:
            TimetableData with extracted information

        Raises:
            FileNotFoundError: If image doesn't exist
            ValueError: If response is invalid or parsing fails
            Exception: If API call fails
        """
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        if not self.client:
            raise ValueError("Claude API key not configured. Set ANTHROPIC_API_KEY environment variable.")

        # Encode image to base64
        with open(image_path, 'rb') as image_file:
            image_data = base64.b64encode(image_file.read()).decode()

        # Get system prompt
        system_prompt = self._get_system_prompt()

        # Call Claude API
        try:
            response = self._call_claude_api(image_data, system_prompt)
        except Exception as e:
            raise Exception(f"Claude API call failed: {str(e)}")

        # Parse and validate response
        try:
            timetable_data = self._parse_response(response)
        except (json.JSONDecodeError, ValueError) as e:
            raise ValueError(f"Failed to parse Claude response: {str(e)}")

        # Validate structure
        if not timetable_data.get('timeblocks'):
            raise ValueError("Invalid response: missing timeblocks")

        return TimetableData(**timetable_data)

    def _call_claude_api(self, image_data: str, system_prompt: str) -> Dict[str, Any]:
        """
        Call Claude API with image and prompt

        Args:
            image_data: Base64-encoded image
            system_prompt: System prompt with instructions

        Returns:
            API response dictionary
        """
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            temperature=0,  # Deterministic
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_data
                            }
                        }
                    ]
                }
            ]
        )

        return {
            "content": [{"type": "text", "text": block.text} for block in response.content]
        }

    def _parse_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Claude API response to timetable data

        Args:
            response: API response dictionary

        Returns:
            Parsed timetable data dictionary
        """
        # Extract text from response
        text_content = ""
        for content in response.get("content", []):
            if content.get("type") == "text":
                text_content += content.get("text", "")

        # Try to extract JSON from response
        # Claude might return JSON wrapped in markdown or additional text
        json_text = self._extract_json(text_content)

        # Parse JSON
        data = json.loads(json_text)

        return data

    def _extract_json(self, text: str) -> str:
        """
        Extract JSON from text that might contain markdown or extra text

        Args:
            text: Text content from Claude

        Returns:
            JSON string
        """
        # Try to find JSON code block
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            return text[start:end].strip()
        elif "```" in text:
            # Try any code block
            start = text.find("```") + 3
            end = text.find("```", start)
            return text[start:end].strip()
        else:
            # Try to find JSON object
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return text[start:end]
        
        return text.strip()

    def _get_system_prompt(self) -> str:
        """
        Get system prompt for Claude API

        Returns:
            System prompt string
        """
        return """You are an expert at extracting school timetable data from images.

Analyze the provided timetable image and extract all scheduled events.

Return a JSON object with this exact structure:
{
  "teacher": "Teacher name (if visible)",
  "className": "Class name (if visible)",
  "term": "Term/semester (if visible)",
  "year": 2024,
  "timeblocks": [
    {
      "day": "Monday|Tuesday|Wednesday|Thursday|Friday",
      "name": "Event/subject name (preserve exact spelling)",
      "startTime": "HH:MM" (24-hour format),
      "endTime": "HH:MM" (24-hour format),
      "notes": "Any additional details"
    }
  ]
}

CRITICAL RULES:
1. Preserve original event names exactly as written
2. Convert all times to 24-hour format (HH:MM)
3. If only duration given, calculate end time
4. Extract ALL events, even if partially visible
5. For merged cells spanning multiple time slots, use the full time range
6. Mark any uncertainty in the notes field
7. Return ONLY valid JSON, no additional text"""

    async def extract_timetable_async(
        self, 
        image_path: str,
        progress_callback=None
    ) -> TimetableData:
        """
        Extract structured timetable data using Claude Vision (async with streaming)
        
        Args:
            image_path: Path to timetable image
            progress_callback: Optional callback function(step: str, percentage: int)
        
        Returns:
            TimetableData with extracted information
        
        Raises:
            FileNotFoundError: If image doesn't exist
            ValueError: If response is invalid or parsing fails
            Exception: If API call fails
        """
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        if not self.async_client:
            raise ValueError("Claude API key not configured. Set ANTHROPIC_API_KEY environment variable.")

        # Step 1: Load image
        if progress_callback:
            await progress_callback("Loading image", 10)
        
        with open(image_path, 'rb') as image_file:
            image_data = base64.b64encode(image_file.read()).decode()

        # Step 2: Prepare request
        if progress_callback:
            await progress_callback("Preparing AI request", 20)
        
        system_prompt = self._get_system_prompt()

        # Step 3: Call Claude API with streaming
        if progress_callback:
            await progress_callback("Analyzing with Claude AI", 30)

        try:
            # Use async streaming API
            chunks = []
            async with self.async_client.messages.stream(
                model=self.model,
                max_tokens=4096,
                temperature=0,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_data
                                }
                            }
                        ]
                    }
                ]
            ) as stream:
                async for text in stream.text_stream:
                    chunks.append(text)
                    # Update progress based on response size
                    if progress_callback:
                        # Estimate progress: 30-90% based on response length
                        estimated_length = len(''.join(chunks))
                        progress = min(90, 30 + (estimated_length / 200) * 60)
                        await progress_callback("Receiving AI response", int(progress))
            
            # Combine all chunks
            response_text = ''.join(chunks)
            
            # Step 4: Parse response
            if progress_callback:
                await progress_callback("Validating results", 95)
            
            timetable_data = self._parse_response({
                "content": [{"type": "text", "text": response_text}]
            })
            
            # Step 5: Complete
            if progress_callback:
                await progress_callback("Complete", 100)
            
            # Validate structure
            if not timetable_data.get('timeblocks'):
                raise ValueError("Invalid response: missing timeblocks")

            return TimetableData(**timetable_data)
            
        except Exception as e:
            raise Exception(f"Claude API call failed: {str(e)}")

