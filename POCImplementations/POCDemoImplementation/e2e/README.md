# E2E Tests - Learning Yogi

End-to-end tests using Playwright for the Learning Yogi timetable extraction platform.

## Setup

```bash
cd e2e
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI mode (recommended)
npm run test:ui

# Run in headed browser
npm run test:headed

# View test report
npm run test:report
```

## Test Structure

```
e2e/
├── tests/
│   ├── upload.spec.ts        # Upload functionality tests
│   ├── results.spec.ts       # Results page tests
│   └── navigation.spec.ts    # Navigation tests
├── playwright.config.ts      # Playwright configuration
└── package.json              # Dependencies
```

## Prerequisites

1. **Start all services**:
   ```bash
   docker-compose up -d
   ```

2. **Verify services are running**:
   - Frontend: http://localhost:3000
   - API: http://localhost:4000
   - Python AI: http://localhost:8000

## Writing Tests

### Basic Structure

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Learning Yogi');
});
```

### Upload Test Example

```typescript
test('should upload timetable image', async ({ page }) => {
  await page.goto('/');
  
  // Find file input
  const fileInput = page.locator('input[type="file"]');
  
  // Upload file
  await fileInput.setInputFiles('../../data/sample_timetables/example.png');
  
  // Wait for upload
  await page.waitForSelector('[class*="processing"]');
  
  // Verify results page
  expect(page.url()).toContain('/results/');
});
```

## Configuration

### Playwright Config

- **Base URL**: http://localhost:3000
- **Test Directory**: ./tests
- **Browsers**: Chromium (configurable)
- **Retries**: 2 on CI, 0 locally
- **Report**: HTML

### Environment Variables

Set these if needed:
- `CI`: Enable CI mode (retries, reduced workers)
- `TEST_BASE_URL`: Override base URL
- `HEADED`: Run in visible browser

## CI/CD Integration

```bash
# Install browsers
npx playwright install

# Run tests
npm test

# Generate report
npm run test:report
```

## Best Practices

1. **Use data-testid** for stable selectors
2. **Wait for elements** before interacting
3. **Use expect.poll** for dynamic content
4. **Group related tests** with describe blocks
5. **Clean up** after tests (fixtures)

## Troubleshooting

### Services Not Running

```bash
# Check docker-compose status
docker-compose ps

# Restart services
docker-compose restart
```

### Browser Not Found

```bash
# Install browsers
npx playwright install
```

### Tests Flaky

- Increase timeout
- Use waitForSelector
- Add retries
- Check network conditions

---

**Version**: 1.0.0  
**Framework**: Playwright

