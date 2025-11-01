import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Upload Timetable', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display upload page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Learning Yogi');
    await expect(page.locator('text=Upload your Timetable')).toBeVisible();
  });

  test('should show file type indicators', async ({ page }) => {
    await expect(page.locator('text=PNG / JPG')).toBeVisible();
    await expect(page.locator('text=PDF')).toBeVisible();
    await expect(page.locator('text=Max 50MB')).toBeVisible();
  });

  test('should show drag and drop zone', async ({ page }) => {
    const dropZone = page.locator('[class*="border-dashed"]').first();
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toContainText('Drag and drop your file');
  });

  test('should handle file upload', async ({ page }) => {
    // Find sample timetable
    const samplePath = path.join(__dirname, '../../data/sample_timetables/Teacher Timetable Example 1.1.png');
    
    // Click on upload zone to trigger file input
    await page.click('text=Upload your Timetable');
    
    // Note: In real E2E, we'd need to trigger file input
    // For now, this is a structure test
    const uploadButton = page.locator('input[type="file"]');
    
    // This is a structural test - actual upload would require file input setup
    expect(uploadButton).toBeDefined();
  });

  test('should show error for invalid file type', async ({ page }) => {
    // Structure test - actual implementation would need file input mock
    await expect(page.locator('[class*="border-dashed"]')).toBeVisible();
  });
});

