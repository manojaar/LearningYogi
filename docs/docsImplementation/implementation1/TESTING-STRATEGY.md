# Testing Strategy - Implementation 1 (TDD Approach)

## Overview

This document outlines a comprehensive Test-Driven Development (TDD) approach for the Learning Yogi platform, ensuring high code quality, reliability, and maintainability.

---

## Test-Driven Development Philosophy

### TDD Cycle: Red-Green-Refactor

```
┌─────────────────┐
│  1. Write Test  │  ← Red: Test fails (feature doesn't exist)
│    (Red)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Implement    │  ← Green: Write minimal code to pass
│    Code (Green) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Refactor    │  ← Refactor: Clean up code, improve design
│                 │
└────────┬────────┘
         │
         └──────────┐
                    │
                    ▼
            ┌───────────────┐
            │  All tests    │
            │  still pass?  │
            └───────┬───────┘
                    │
              Yes   │   No
        ┌───────────┴──────────┐
        ▼                      ▼
   ┌─────────┐          ┌──────────┐
   │  Done   │          │ Fix code │
   └─────────┘          └────┬─────┘
                             │
                             └──────────┐
                                        │
                                        ▼
                                 (Continue refactor)
```

### Benefits of TDD

1. **Better Design**: Forces you to think about API design before implementation
2. **High Coverage**: Tests written first ensure comprehensive coverage
3. **Living Documentation**: Tests serve as documentation of expected behavior
4. **Regression Prevention**: Catch bugs early when refactoring
5. **Confidence**: Deploy with confidence knowing tests pass

---

## Test Pyramid

```
         /\
        /  \
       /  5%\   E2E Tests (Slow, Expensive, Brittle)
      /______\
     /        \
    /   15%   \  Integration Tests (Medium Speed, Medium Cost)
   /__________\
  /            \
 /     80%      \  Unit Tests (Fast, Cheap, Focused)
/________________\
```

### Target Coverage

| Test Type | Coverage | Rationale |
|-----------|----------|-----------|
| Unit Tests | 80-90% | Core business logic, utilities, validators |
| Integration Tests | 60-70% | Service interactions, database operations, external APIs |
| E2E Tests | Critical paths only | User journeys, happy paths, critical failures |
| Contract Tests | 100% service boundaries | Ensure API compatibility between services |

---

## Testing Tools

### Node.js Services

#### Unit & Integration Testing

**Framework**: Jest
```json
{
  "name": "learning-yogi-bff",
  "scripts": {
    "test": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 85,
        "statements": 85
      }
    }
  }
}
```

**Why Jest**:
- Built-in coverage reporting
- Snapshot testing
- Parallel test execution
- Excellent TypeScript support
- Large ecosystem and community

**API Testing**: Supertest
```bash
npm install --save-dev supertest @types/supertest
```

**Mocking**: Jest built-in mocks + MSW (Mock Service Worker) for API mocks
```bash
npm install --save-dev msw
```

**Database Testing**: Testcontainers for isolated database tests
```bash
npm install --save-dev testcontainers
```

---

### Python Services

#### Unit & Integration Testing

**Framework**: pytest
```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --verbose
    --cov=src
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=85
```

**Why pytest**:
- Powerful fixture system
- Parametrized tests
- Excellent plugins ecosystem
- Clean assertion syntax
- Parallel execution with pytest-xdist

**Mocking**: pytest-mock + responses (for HTTP)
```bash
pip install pytest-mock responses pytest-cov
```

**Async Testing**: pytest-asyncio
```bash
pip install pytest-asyncio
```

---

### E2E Testing

**Framework**: Playwright (for frontend + API)
```bash
npm install --save-dev @playwright/test
```

**Why Playwright**:
- Multi-browser support (Chromium, Firefox, WebKit)
- Auto-waiting (reduces flakiness)
- Network interception
- Mobile emulation for PWA testing
- Parallel execution
- Video/screenshot on failure

**Alternative**: Cypress (good for frontend-only E2E)

---

### Contract Testing

**Framework**: Pact
```bash
npm install --save-dev @pact-foundation/pact
```

**Purpose**: Ensure API contracts between services are maintained
- Consumer-driven contracts
- Provider verification
- Prevents breaking changes

---

### Load Testing

**Framework**: k6
```bash
brew install k6  # or equivalent
```

**Purpose**: Performance and load testing
- Simulate realistic user load
- Identify bottlenecks
- Ensure SLA compliance

---

## TDD Workflow Examples

### Example 1: Unit Test for Validation Service (Node.js)

#### Step 1: Write Test (Red)

```typescript
// tests/unit/validators/timeblock.validator.test.ts

import { TimeblockValidator } from '../../../src/validators/timeblock.validator';

describe('TimeblockValidator', () => {
  describe('validate', () => {
    it('should accept valid timeblock data', () => {
      const validator = new TimeblockValidator();
      const data = {
        name: 'Maths',
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
      };

      const result = validator.validate(data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'Maths',
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        duration: 60,
      });
    });

    it('should reject invalid time format', () => {
      const validator = new TimeblockValidator();
      const data = {
        name: 'Maths',
        dayOfWeek: 'Monday',
        startTime: '9am',  // Invalid format
        endTime: '10:00',
      };

      const result = validator.validate(data);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toEqual(['startTime']);
      expect(result.error.issues[0].message).toContain('Invalid time format');
    });

    it('should reject start time after end time', () => {
      const validator = new TimeblockValidator();
      const data = {
        name: 'Maths',
        dayOfWeek: 'Monday',
        startTime: '10:00',
        endTime: '09:00',  // Before start
      };

      const result = validator.validate(data);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Start time must be before end time');
    });

    it('should calculate duration correctly', () => {
      const validator = new TimeblockValidator();
      const data = {
        name: 'Maths',
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:30',
      };

      const result = validator.validate(data);

      expect(result.success).toBe(true);
      expect(result.data.duration).toBe(90);
    });

    it('should reject duration less than 5 minutes', () => {
      const validator = new TimeblockValidator();
      const data = {
        name: 'Maths',
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '09:03',  // 3 minutes
      };

      const result = validator.validate(data);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Duration must be at least 5 minutes');
    });
  });
});
```

#### Step 2: Implement Code (Green)

```typescript
// src/validators/timeblock.validator.ts

import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeblockSchema = z.object({
  name: z.string().min(1).max(100),
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
  endTime: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
  notes: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).refine((data) => {
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return startMinutes < endMinutes;
}, {
  message: 'Start time must be before end time',
  path: ['startTime'],
}).refine((data) => {
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  return duration >= 5;
}, {
  message: 'Duration must be at least 5 minutes',
  path: ['startTime'],
});

export class TimeblockValidator {
  validate(data: unknown) {
    const result = timeblockSchema.safeParse(data);

    if (result.success) {
      const [startHour, startMin] = result.data.startTime.split(':').map(Number);
      const [endHour, endMin] = result.data.endTime.split(':').map(Number);
      const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

      return {
        success: true,
        data: {
          ...result.data,
          duration,
        },
      };
    }

    return result;
  }
}
```

#### Step 3: Refactor

- Extract time parsing logic to utility function
- Add TypeScript types
- Improve error messages

```typescript
// src/utils/time.utils.ts

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

export function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
}

// Refactored validator.ts uses these utilities
```

#### Run Tests

```bash
npm test -- timeblock.validator.test.ts

# Output:
# PASS tests/unit/validators/timeblock.validator.test.ts
#   TimeblockValidator
#     validate
#       ✓ should accept valid timeblock data (5ms)
#       ✓ should reject invalid time format (3ms)
#       ✓ should reject start time after end time (2ms)
#       ✓ should calculate duration correctly (2ms)
#       ✓ should reject duration less than 5 minutes (3ms)
#
# Test Suites: 1 passed, 1 total
# Tests:       5 passed, 5 total
# Coverage:    95% lines, 90% branches
```

---

### Example 2: Integration Test for OCR Service (Python)

#### Step 1: Write Test (Red)

```python
# tests/integration/test_ocr_service.py

import pytest
from unittest.mock import Mock, patch
from src.services.ocr_service import OCRService
from src.models.ocr_result import OCRResult

@pytest.fixture
def ocr_service():
    return OCRService()

@pytest.fixture
def sample_image_path(tmp_path):
    """Create a temporary test image"""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)

    # Draw simple timetable
    draw.text((100, 100), "Monday 09:00-10:00 Maths", fill='black')
    draw.text((100, 150), "Monday 10:00-11:00 English", fill='black')

    image_path = tmp_path / "timetable.png"
    img.save(image_path)
    return str(image_path)

class TestOCRService:

    def test_process_image_returns_ocr_result(self, ocr_service, sample_image_path):
        """Test that OCR service processes image and returns structured result"""
        result = ocr_service.process_image(sample_image_path)

        assert isinstance(result, OCRResult)
        assert result.text is not None
        assert 0 <= result.confidence <= 100
        assert result.processing_time_ms > 0

    def test_process_image_extracts_text_correctly(self, ocr_service, sample_image_path):
        """Test that OCR correctly extracts text from image"""
        result = ocr_service.process_image(sample_image_path)

        assert "Monday" in result.text
        assert "Maths" in result.text
        assert "English" in result.text

    def test_process_image_calculates_confidence(self, ocr_service, sample_image_path):
        """Test that confidence score is calculated correctly"""
        result = ocr_service.process_image(sample_image_path)

        # For clear, synthetic text, confidence should be high
        assert result.confidence >= 90

    def test_process_image_with_poor_quality_returns_low_confidence(self, ocr_service, tmp_path):
        """Test that low quality images return low confidence scores"""
        from PIL import Image, ImageFilter

        # Create blurry image
        img = Image.new('RGB', (800, 600), color='white')
        img = img.filter(ImageFilter.GaussianBlur(radius=10))

        image_path = tmp_path / "blurry.png"
        img.save(image_path)

        result = ocr_service.process_image(str(image_path))

        # Low quality should result in lower confidence
        assert result.confidence < 90

    def test_process_image_with_invalid_file_raises_error(self, ocr_service):
        """Test that invalid file path raises appropriate error"""
        with pytest.raises(FileNotFoundError):
            ocr_service.process_image("/nonexistent/file.png")

    @patch('src.services.ocr_service.pytesseract.image_to_data')
    def test_process_image_handles_tesseract_errors(self, mock_tesseract, ocr_service, sample_image_path):
        """Test that Tesseract errors are handled gracefully"""
        mock_tesseract.side_effect = Exception("Tesseract error")

        with pytest.raises(OCRProcessingError) as exc_info:
            ocr_service.process_image(sample_image_path)

        assert "Tesseract error" in str(exc_info.value)

    def test_process_image_caches_results(self, ocr_service, sample_image_path):
        """Test that repeated processing of same image uses cache"""
        # First call
        result1 = ocr_service.process_image(sample_image_path)
        time1 = result1.processing_time_ms

        # Second call (should be faster due to cache)
        result2 = ocr_service.process_image(sample_image_path)
        time2 = result2.processing_time_ms

        assert result1.text == result2.text
        assert time2 < time1  # Cache hit should be faster
```

#### Step 2: Implement Code (Green)

```python
# src/services/ocr_service.py

import hashlib
import time
from pathlib import Path
from typing import Optional
import pytesseract
from PIL import Image
import redis
from src.models.ocr_result import OCRResult
from src.exceptions import OCRProcessingError

class OCRService:
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client or redis.Redis(
            host='localhost',
            port=6379,
            decode_responses=False
        )
        self.cache_ttl = 30 * 24 * 60 * 60  # 30 days

    def process_image(self, image_path: str) -> OCRResult:
        """
        Process an image using Tesseract OCR.

        Args:
            image_path: Path to the image file

        Returns:
            OCRResult with extracted text and confidence

        Raises:
            FileNotFoundError: If image file doesn't exist
            OCRProcessingError: If OCR processing fails
        """
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        # Check cache
        cache_key = self._get_cache_key(image_path)
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            return cached_result

        # Process image
        start_time = time.time()

        try:
            image = Image.open(image_path)

            # Extract text with confidence data
            ocr_data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT,
                config='--psm 6'  # Assume uniform block of text
            )

            # Extract text
            text = pytesseract.image_to_string(image)

            # Calculate confidence
            confidences = [int(conf) for conf in ocr_data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            processing_time_ms = int((time.time() - start_time) * 1000)

            result = OCRResult(
                text=text.strip(),
                confidence=round(avg_confidence, 2),
                processing_time_ms=processing_time_ms,
                word_count=len(text.split()),
                layout_data=ocr_data
            )

            # Cache result
            self._save_to_cache(cache_key, result)

            return result

        except Exception as e:
            raise OCRProcessingError(f"Failed to process image: {str(e)}") from e

    def _get_cache_key(self, image_path: str) -> str:
        """Generate cache key from image file hash"""
        with open(image_path, 'rb') as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()
        return f"ocr:result:{file_hash}"

    def _get_from_cache(self, cache_key: str) -> Optional[OCRResult]:
        """Retrieve result from Redis cache"""
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                return OCRResult.from_json(cached_data)
        except Exception:
            pass  # Cache miss or error, proceed with processing
        return None

    def _save_to_cache(self, cache_key: str, result: OCRResult) -> None:
        """Save result to Redis cache"""
        try:
            self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                result.to_json()
            )
        except Exception:
            pass  # Cache save failure shouldn't break processing
```

```python
# src/models/ocr_result.py

import json
from dataclasses import dataclass, asdict
from typing import Any, Dict

@dataclass
class OCRResult:
    text: str
    confidence: float
    processing_time_ms: int
    word_count: int = 0
    layout_data: Dict[str, Any] = None

    def to_json(self) -> str:
        data = asdict(self)
        return json.dumps(data)

    @classmethod
    def from_json(cls, json_str: str) -> 'OCRResult':
        data = json.loads(json_str)
        return cls(**data)
```

#### Step 3: Refactor

- Extract confidence calculation to separate method
- Add type hints
- Improve error handling
- Add logging

#### Run Tests

```bash
pytest tests/integration/test_ocr_service.py -v

# Output:
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_returns_ocr_result PASSED
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_extracts_text_correctly PASSED
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_calculates_confidence PASSED
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_with_poor_quality_returns_low_confidence PASSED
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_with_invalid_file_raises_error PASSED
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_handles_tesseract_errors PASSED
# tests/integration/test_ocr_service.py::TestOCRService::test_process_image_caches_results PASSED
#
# ======================== 7 passed in 3.42s ========================
# Coverage: 92%
```

---

## Test Organization Structure

### Node.js Services

```
src/
├── controllers/
├── services/
├── models/
├── validators/
├── utils/
└── ...

tests/
├── unit/
│   ├── controllers/
│   ├── services/
│   ├── validators/
│   └── utils/
├── integration/
│   ├── api/
│   ├── database/
│   └── external-services/
├── e2e/
│   └── workflows/
├── fixtures/
│   ├── sample-data.json
│   └── test-images/
└── helpers/
    ├── test-database.ts
    └── mock-factories.ts
```

### Python Services

```
src/
├── services/
├── models/
├── utils/
└── ...

tests/
├── unit/
│   ├── services/
│   ├── models/
│   └── utils/
├── integration/
│   ├── services/
│   └── external_apis/
├── fixtures/
│   ├── sample_images/
│   └── sample_documents/
└── conftest.py  # Shared pytest fixtures
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests-node:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci
        working-directory: ./services/bff

      - name: Run unit tests
        run: npm run test:unit
        working-directory: ./services/bff

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./services/bff/coverage/coverage-final.json
          flags: bff-unit

  integration-tests-node:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: learningyogi_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: npm ci
        working-directory: ./services/bff

      - name: Run database migrations
        run: npm run db:migrate
        working-directory: ./services/bff
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/learningyogi_test

      - name: Run integration tests
        run: npm run test:integration
        working-directory: ./services/bff
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/learningyogi_test
          REDIS_URL: redis://localhost:6379

  unit-tests-python:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11']

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
        working-directory: ./services/ocr

      - name: Run unit tests
        run: pytest tests/unit/ --cov=src --cov-report=xml
        working-directory: ./services/ocr

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./services/ocr/coverage.xml
          flags: ocr-unit

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests-node, integration-tests-node, unit-tests-python]

    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: npm ci
        working-directory: ./tests/e2e

      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        working-directory: ./tests/e2e

      - name: Start services (Docker Compose)
        run: docker-compose up -d
        working-directory: ./

      - name: Wait for services to be ready
        run: npm run wait-for-services
        working-directory: ./tests/e2e

      - name: Run E2E tests
        run: npx playwright test
        working-directory: ./tests/e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/

      - name: Stop services
        if: always()
        run: docker-compose down
        working-directory: ./
```

---

## Test Coverage Goals

### Overall Coverage Targets

| Service | Unit Coverage | Integration Coverage | E2E Coverage |
|---------|---------------|----------------------|--------------|
| BFF Service | 85% | 70% | Critical paths |
| Auth Service | 90% | 75% | Login/Register |
| WebSocket Server | 80% | 60% | Connection/Events |
| Classification Service | 85% | 70% | - |
| Preprocessing Service | 80% | 65% | - |
| OCR Service | 85% | 75% | - |
| LLM Service | 80% | 70% | - |
| Validation Service | 90% | 75% | - |

### Critical Code Paths (100% Coverage Required)

- Authentication and authorization logic
- Data validation and sanitization
- Payment processing (if applicable)
- Data encryption/decryption
- Security-sensitive operations

---

## Performance Testing

### Load Testing with k6

```javascript
// tests/load/upload-document.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete within 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be < 1%
  },
};

export default function () {
  const url = 'http://localhost:3000/api/v1/documents/upload';

  const formData = new FormData();
  formData.append('file', http.file(open('fixtures/sample-timetable.pdf', 'b'), 'timetable.pdf'));

  const res = http.post(url, formData.body(), {
    headers: {
      'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
      'Content-Type': 'multipart/form-data; boundary=' + formData.boundary,
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'jobId returned': (r) => JSON.parse(r.body).jobId !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run load test:
```bash
k6 run tests/load/upload-document.js
```

---

## Continuous Testing Best Practices

### 1. Test Isolation
- Each test should be independent
- No shared state between tests
- Use fixtures and factories for test data
- Clean up after tests (database, files, etc.)

### 2. Test Naming Convention

```
test_[method]_[scenario]_[expected_result]

Examples:
- test_process_image_with_valid_input_returns_success
- test_validate_timeblock_with_invalid_time_raises_error
- test_upload_document_with_large_file_returns_413
```

### 3. Arrange-Act-Assert Pattern

```typescript
test('should create timetable', async () => {
  // Arrange
  const user = await createTestUser();
  const data = {
    name: 'Test Timetable',
    year: 2024,
  };

  // Act
  const result = await timetableService.create(user.id, data);

  // Assert
  expect(result.id).toBeDefined();
  expect(result.name).toBe('Test Timetable');
  expect(result.userId).toBe(user.id);
});
```

### 4. Mock External Dependencies

```typescript
// Mock LLM API
jest.mock('../src/services/anthropic.service');

test('should use LLM when OCR confidence is low', async () => {
  const mockAnthropicService = AnthropicService as jest.MockedClass<typeof AnthropicService>;
  mockAnthropicService.prototype.extractTimetable.mockResolvedValue({
    timeblocks: [...],
    confidence: 95,
  });

  // Test logic that calls LLM service
});
```

### 5. Snapshot Testing for UI Components

```typescript
import { render } from '@testing-library/react';
import { TimetableGrid } from '../src/components/TimetableGrid';

test('renders timetable correctly', () => {
  const { container } = render(<TimetableGrid timeblocks={mockTimeblocks} />);
  expect(container).toMatchSnapshot();
});
```

---

## Test Maintenance

### Regular Activities

1. **Weekly**: Review failed tests, update flaky tests
2. **Monthly**: Review and remove obsolete tests
3. **Quarterly**: Refactor test code, update test dependencies
4. **Per Release**: Update E2E tests for new features

### Test Debt Management

- Keep test code quality as high as production code
- Refactor tests when refactoring production code
- Delete tests for removed features
- Update tests for changed requirements

---

## Conclusion

This TDD approach ensures:
- High code quality through comprehensive testing
- Confidence in refactoring and feature additions
- Early bug detection
- Living documentation through tests
- Faster development cycles (less debugging)

By following this strategy, the Learning Yogi platform will maintain high reliability and ease of maintenance throughout its lifecycle.
