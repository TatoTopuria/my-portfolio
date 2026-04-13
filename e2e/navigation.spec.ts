import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load homepage and show hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Tato Topuria/);
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('app-header')).toBeVisible();
    await expect(page.locator('app-footer')).toBeVisible();
  });

  test('should navigate to 404 for unknown routes', async ({ page }) => {
    await page.goto('/non-existent-page');
    await expect(page.locator('h1')).toContainText('Page Not Found');
  });

  test('should have skip to content link', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();
  });
});
