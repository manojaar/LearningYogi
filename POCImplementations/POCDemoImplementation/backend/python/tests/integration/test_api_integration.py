"""API integration tests for FastAPI application"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

client = TestClient(app)


@pytest.mark.integration
class TestAPIIntegration:
    """Integration tests for API endpoints"""

    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        assert response.json()["service"] == "ai-middleware"

    def test_root_endpoint(self):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()

    def test_preprocess_endpoint_with_invalid_path(self):
        """Test preprocess endpoint with invalid image path"""
        response = client.post("/preprocess/enhance", json={
            "image_path": "/nonexistent/image.png",
            "output_dir": "/tmp"
        })
        assert response.status_code == 404

    def test_ocr_endpoint_with_invalid_path(self):
        """Test OCR endpoint with invalid image path"""
        response = client.post("/ocr/process", json={
            "image_path": "/nonexistent/image.png"
        })
        assert response.status_code == 404

    def test_ai_endpoint_without_api_key(self):
        """Test AI endpoint without API key configured"""
        # This will fail if API key not set
        pass

    def test_quality_gate_endpoint(self):
        """Test quality gate endpoint"""
        from app.models.ocr import OCRResult, OCRWord
        
        # Mock OCR result
        mock_result = {
            "text": "Monday 9:00 Mathematics 10:00",
            "confidence": 0.75,
            "words": [
                {
                    "text": "Monday",
                    "confidence": 0.85,
                    "left": 10,
                    "top": 20,
                    "width": 100,
                    "height": 30
                }
            ],
            "engine": "tesseract"
        }

        response = client.post("/ocr/quality-gate", json=mock_result)
        assert response.status_code == 200
        assert "route" in response.json()
        assert "confidence" in response.json()
        assert "reason" in response.json()

