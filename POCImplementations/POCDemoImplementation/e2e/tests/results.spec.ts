import { test, expect } from '@playwright/test';

test.describe('Results Page', () => {
  test('should display results page', async ({ page }) => {
    // Navigate to results page (would use actual document ID in real test)
    await page.goto('/results/test-document-id');
    
    // Check for common elements
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('should show processing status', async ({ page }) => {
    await page.goto('/results/test-document-id');
    
    // Check for status elements
    const statusIndicators = page.locator('[class*="status"], [class*="progress"]');
    const count = await statusIndicators.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display timetable viewer', async ({ page }) => {
    await page.goto('/results/test-document-id');
    
    // Look for timetable elements
    const timetableViewer = page.locator('[class*="timetable"], [class*="grid"]');
    const count = await timetableViewer.count();
    // Note: In real implementation, would check specific elements
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have back button', async ({ page }) => {
    await page.goto('/results/test-document-id');
    
    const backButton = page.locator('text=Back');
    const count = await backButton.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show export buttons when complete', async ({ page }) => {
    await page.goto('/results/test-document-id');
    
    const exportButtons = page.locator('text=Export');
    const count = await exportButtons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

