import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
  test('should toggle dark mode and persist preference', async ({ page }) => {
    await page.goto('/');

    // Default: light mode
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Click theme toggle
    const toggle = page.getByRole('button', { name: /toggle dark mode/i });
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload - should persist
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Toggle back to light
    await toggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
