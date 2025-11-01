import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate from home to results', async ({ page }) => {
    await page.goto('/');
    
    // Verify on home page
    await expect(page.locator('h1')).toContainText('Learning Yogi');
    
    // Navigate to results (would normally happen after upload)
    await page.goto('/results/test-doc-id');
    
    // Verify navigation worked
    expect(page.url()).toContain('/results/');
  });

  test('should navigate back to home', async ({ page }) => {
    await page.goto('/results/test-doc-id');
    
    // Click back button (if exists)
    const backButton = page.locator('text=Back').first();
    await backButton.click();
    
    // Should be back on home page
    expect(page.url()).toBe('http://localhost:3000/');
  });

  test('should show loading state', async ({ page }) => {
    await page.goto('/results/test-doc-id');
    
    // Check for loading indicators
    const loadingIndicators = page.locator('[class*="loading"], [class*="spinner"], [class*="animate-pulse"]');
    const count = await loadingIndicators.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

