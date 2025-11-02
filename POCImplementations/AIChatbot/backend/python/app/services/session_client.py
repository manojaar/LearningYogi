"""
Session client - fetches LLM settings from Node.js API
"""

import os
import httpx
from typing import Optional, Dict, Any


class SessionClient:
    """Client for fetching LLM session settings from Node.js backend"""

    def __init__(self):
        # Get Node.js API URL from environment or use default
        self.nodejs_api_url = os.environ.get(
            "NODEJS_API_URL",
            "http://nodejs-api:4000"  # Docker service name
        )
        self.client = httpx.AsyncClient(timeout=10.0)

    async def get_llm_settings(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch LLM settings from Node.js backend
        
        Returns:
            Dict with provider, model, apiKey, or None if not found
        """
        if not session_id:
            return None

        try:
            response = await self.client.get(
                f"{self.nodejs_api_url}/api/v1/llm/settings",
                headers={
                    "x-session-id": session_id,
                    "x-internal-request": "true"  # Indicate this is an internal request
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "provider": data.get("provider"),
                    "model": data.get("model"),
                    "apiKey": data.get("apiKey"),  # API key is decrypted by Node.js
                }
            elif response.status_code == 404:
                # Session not found or expired
                return None
            else:
                print(f"Failed to fetch LLM settings: {response.status_code}")
                return None
        except Exception as e:
            print(f"Error fetching LLM settings: {e}")
            return None

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

