# Testing Guide

## Overview

The POCDemoImplementation follows a Test-Driven Development (TDD) approach, with comprehensive test coverage across all layers: unit tests, integration tests, and end-to-end tests.

## Test Structure

```
POCDemoImplementation/
├── backend/
│   ├── python/
│   │   ├── tests/
│   │   │   ├── test_preprocessor.py          # Image preprocessing tests
│   │   │   ├── test_ocr_service.py           # OCR service tests
│   │   │   ├── test_claude_service.py        # Claude AI integration tests
│   │   │   ├── integration/
│   │   │   │   ├── test_integration.py       # Pipeline integration tests
│   │   │   │   └── test_api_integration.py   # API integration tests
│   │   └── pytest.ini                        # Pytest configuration
│   │
│   └── nodejs/
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── storage.test.ts           # Storage service tests
│       │   │   └── validation.test.ts        # Validation service tests
│       │   ├── integration/
│       │   │   ├── api.test.ts               # API endpoint tests
│       │   │   ├── document.service.test.ts  # Document service tests
│       │   │   └── validation.test.ts        # Validation integration tests
│       └── jest.config.js                    # Jest configuration
│
└── e2e/
    ├── tests/
    │   ├── upload.spec.ts                    # Upload flow tests
    │   ├── results.spec.ts                   # Results page tests
    │   └── navigation.spec.ts                # Navigation tests
    ├── playwright.config.ts                  # Playwright configuration
    └── package.json                          # E2E dependencies
```

## Running Tests

### Quick Start

Run all tests with the test runner script:

```bash
./run-tests.sh
```

This will:
1. Run Python unit and integration tests
2. Run Node.js unit and integration tests
3. Run E2E tests with Playwright
4. Generate coverage reports

### Individual Test Suites

```bash
# Python tests only
./run-tests.sh python

# Node.js tests only
./run-tests.sh nodejs

# E2E tests only
./run-tests.sh e2e

# All tests
./run-tests.sh all
```

### Manual Execution

#### Python Tests

```bash
cd backend/python

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_ocr_service.py

# Run specific test
pytest tests/test_ocr_service.py::TestOCRService::test_process_image

# Run integration tests
pytest tests/integration/
```

#### Node.js Tests

```bash
cd backend/nodejs

# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/storage.test.ts

# Run integration tests
npm test -- tests/integration/
```

#### E2E Tests

```bash
cd e2e

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all E2E tests
npm test

# Run with UI mode
npm run test:ui

# Run in headed browser
npm run test:headed

# View test report
npm run test:report
```

## Test Categories

### 1. Unit Tests

Test individual functions and components in isolation.

#### Python Unit Tests

**Image Preprocessing** (`test_preprocessor.py`):
- Grayscale conversion
- Noise reduction
- Adaptive thresholding
- Deskewing/rotation correction
- Edge detection

**OCR Service** (`test_ocr_service.py`):
- Tesseract OCR extraction
- Confidence scoring
- Quality gate decisions
- Time pattern extraction
- Word-level metadata

**Claude Service** (`test_claude_service.py`):
- API integration
- Response parsing
- Structured data extraction
- Error handling
- Retry logic

#### Node.js Unit Tests

**Storage Service** (`storage.test.ts`):
- File save/read/delete operations
- Directory management
- Unique filename generation
- File existence checks

**Validation Service** (`validation.test.ts`):
- Timetable data validation
- Time format validation
- Conflict detection
- Error message generation

### 2. Integration Tests

Test components working together across service boundaries.

#### Python Integration Tests

**Pipeline Integration** (`test_integration.py`):
- End-to-end preprocessing → OCR → AI
- Quality gate routing
- Error recovery
- Sample timetable processing

**API Integration** (`test_api_integration.py`):
- FastAPI endpoint testing
- Request/response validation
- Error handling
- Health checks

#### Node.js Integration Tests

**API Endpoints** (`api.test.ts`):
- Document upload flow
- Status retrieval
- Timetable extraction
- Error responses

**Document Service** (`document.service.test.ts`):
- Document lifecycle management
- Processing orchestration
- Database integration
- Storage integration

**Validation** (`validation.test.ts`):
- Complex timetable validation
- Multiple day conflicts
- Invalid data handling
- Quality scoring

### 3. End-to-End Tests

Test the complete user journey from frontend to backend.

**Upload Flow** (`upload.spec.ts`):
- File upload via UI
- Drag-and-drop functionality
- File type validation
- Error messages

**Results Page** (`results.spec.ts`):
- Processing status display
- Timetable viewer rendering
- Export functionality
- Navigation

**Navigation** (`navigation.spec.ts`):
- Route changes
- Back navigation
- Loading states
- Error boundaries

## Test Data

### Sample Timetables

Located in `data/sample_timetables/`:
- `Teacher Timetable Example 1.1.png` - Color-coded grid
- `Teacher Timetable Example 1.2.png` - Similar grid
- `Teacher Timetable Example 2.pdf` - PDF format
- `Teacher Timetable Example 3.png` - Alternative layout
- `Teacher Timetable Example 4.jpeg` - Photograph

### Mock Data

- Python: Mock Claude API responses in `test_claude_service.py`
- Node.js: Mock Python AI middleware in integration tests
- Frontend: Mock API responses in component tests

## Coverage Goals

| Layer | Target Coverage |
|-------|----------------|
| Python Services | 85%+ |
| Node.js Services | 80%+ |
| Frontend Components | 75%+ |
| Integration Tests | 70%+ |
| E2E Tests | 90% user flows |

### Current Coverage

View coverage reports:

```bash
# Python coverage
open backend/python/htmlcov/index.html

# Node.js coverage
open backend/nodejs/coverage/lcov-report/index.html

# E2E report
open e2e/playwright-report/index.html
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - run: cd backend/python && pip install -r requirements.txt && pytest
      
  node-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: cd backend/nodejs && npm install && npm test
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: cd e2e && npm install && npx playwright install && npm test
```

## Writing New Tests

### Python Test Template

```python
import pytest
from app.services.your_service import YourService

class TestYourService:
    @pytest.fixture
    def service(self):
        return YourService()

    def test_your_method(self, service):
        # Arrange
        input = "test input"
        
        # Act
        result = service.your_method(input)
        
        # Assert
        assert result is not None
        assert result == "expected output"
```

### Node.js Test Template

```typescript
import { YourService } from '../../src/services/your.service';

describe('YourService', () => {
  let service: YourService;

  beforeEach(() => {
    service = new YourService();
  });

  it('should do something', () => {
    const result = service.yourMethod('input');
    expect(result).toBe('expected');
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Your Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

## Test Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Isolation**: Each test should be independent
3. **Descriptive names**: Test names should describe what they test
4. **Mock external services**: Don't call real APIs in unit tests
5. **Use fixtures**: Share setup/teardown code
6. **Test edge cases**: Include boundary and error conditions
7. **Keep tests fast**: Unit tests should run in milliseconds
8. **Maintain tests**: Update tests when code changes

## Troubleshooting

### Python Tests Fail

```bash
# Check pytest installation
pip list | grep pytest

# Run with verbose output
pytest -v

# Run with print statements
pytest -s

# Check for import errors
python -c "from app.services.ocr_service import OCRService"
```

### Node.js Tests Fail

```bash
# Clear Jest cache
npm test -- --clearCache

# Run with verbose output
npm test -- --verbose

# Check TypeScript compilation
npm run build
```

### E2E Tests Fail

```bash
# Reinstall Playwright browsers
npx playwright install --force

# Run in headed mode to see what's happening
npm run test:headed

# Check server is running
curl http://localhost:3000/health
```

### Coverage Not Updating

```bash
# Clear coverage directories
rm -rf backend/python/htmlcov backend/nodejs/coverage

# Re-run with coverage
./run-tests.sh
```

## Debugging Tips

### Python Debugging

```python
# Add breakpoint in test
import pdb; pdb.set_trace()

# Print debug info
print(f"Debug: {variable}")

# Use pytest fixture with manual inspection
@pytest.fixture
def debug_data():
    return complex_data  # Inspect in debugger
```

### Node.js Debugging

```typescript
// Add console.log
console.log('Debug:', variable);

// Use debugger statement
debugger;

// Run with Node inspector
node --inspect-brk node_modules/jest/bin/jest.js --runInBand
```

### E2E Debugging

```typescript
// Take screenshot on failure
await page.screenshot({ path: 'debug.png' });

// Pause test execution
await page.pause();

// Slow down actions
test.use({ slowMo: 500 });
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://www.browserstack.com/guide/testing-best-practices)

---

**Last Updated**: 2024-11-01  
**Maintainer**: Development Team
