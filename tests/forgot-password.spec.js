import { test, expect } from '@playwright/test';
import { stores } from './stores.js';

for (const store of stores) {
  test(`forgot password page: ${store.name}`, async ({ page }) => {
    const url = new URL('/forget?redirect=%2Fcheckout', store.url).href;
    await page.goto(url);

    // Phone field is there and accepts input
    const phone = page.getByRole('textbox', { name: /phone/i });
    await expect(phone).toBeVisible();
    await phone.fill(process.env.TEST_PHONE ?? '9800000000');

    // CAPTCHA widget loads, and the Continue button exists (we do not solve it)
    await expect(page.locator('iframe[title*="reCAPTCHA" i], iframe[name^="a-"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });
}