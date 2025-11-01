"""Tests for image preprocessing service"""

import os
import sys
import pytest
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.preprocessor import ImagePreprocessor


@pytest.fixture
def preprocessor():
    """Create a preprocessor instance"""
    return ImagePreprocessor()


@pytest.fixture
def sample_image_path():
    """Path to a sample timetable image"""
    # Path relative to project root
    base_path = Path(__file__).parent.parent.parent.parent
    test_image = base_path / "data" / "sample_timetables" / "Teacher Timetable Example 1.1.png"
    if test_image.exists():
        return str(test_image)
    else:
        pytest.skip("Sample timetable image not found")


@pytest.mark.unit
class TestImagePreprocessor:
    """Unit tests for ImagePreprocessor"""

    def test_init(self, preprocessor):
        """Test preprocessor initialization"""
        assert preprocessor is not None
        assert isinstance(preprocessor, ImagePreprocessor)

    def test_enhance_image_creates_output(self, preprocessor, sample_image_path, tmp_path):
        """Test that enhanced image is created"""
        output_path = preprocessor.enhance_image(sample_image_path, str(tmp_path))
        
        assert output_path is not None
        assert os.path.exists(output_path)
        assert Path(output_path).suffix == '.png'

    def test_enhance_image_grayscale(self, preprocessor, sample_image_path, tmp_path):
        """Test that enhanced image is grayscale"""
        output_path = preprocessor.enhance_image(sample_image_path, str(tmp_path))
        
        import cv2
        img = cv2.imread(output_path, cv2.IMREAD_GRAYSCALE)
        
        assert len(img.shape) == 2  # Grayscale has 2 dimensions

    def test_enhance_image_invalid_path(self, preprocessor, tmp_path):
        """Test error handling for invalid image path"""
        with pytest.raises(FileNotFoundError):
            preprocessor.enhance_image("/nonexistent/image.png", str(tmp_path))

    def test_enhance_image_output_directory(self, preprocessor, sample_image_path, tmp_path):
        """Test that output directory is created if needed"""
        output_dir = tmp_path / "enhanced" / "subdir"
        output_path = preprocessor.enhance_image(sample_image_path, str(output_dir))
        
        assert output_dir.exists()
        assert os.path.exists(output_path)

    def test_enhance_image_preserves_content(self, preprocessor, sample_image_path, tmp_path):
        """Test that enhancement doesn't significantly distort image dimensions"""
        import cv2
        
        original = cv2.imread(sample_image_path)
        h_orig, w_orig = original.shape[:2]
        
        output_path = preprocessor.enhance_image(sample_image_path, str(tmp_path))
        enhanced = cv2.imread(output_path)
        h_enh, w_enh = enhanced.shape[:2]
        
        # Dimensions should be roughly the same (within 2 pixels)
        assert abs(h_orig - h_enh) <= 2
        assert abs(w_orig - w_enh) <= 2

