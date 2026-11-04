import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://superopizza.com.au/');
  const page1Promise = page.waitForEvent('popup');
  await page.locator('[id="3589102b-fbd4-4959-812c-3653626300d3"]').getByRole('link', { name: 'Order Now' }).click();
  const page1 = await page1Promise;
  await page1.getByRole('button', { name: 'PickUp', exact: true }).click();

  // Only schedule for tomorrow if the site asks for it
  const tomorrow = page1.getByText('TOMORROW');
  const hasSchedule = await tomorrow
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (hasSchedule) {
    await tomorrow.click();
    await page1.locator('div').filter({ hasText: /^05:00 PM$/ }).click();
    await page1.getByRole('button', { name: 'Confirm Schedule' }).click();
  } else {
    console.log('NO TOMORROW OPTION. PAGE SHOWS:');
    console.log(await page1.locator('body').innerText());
  }

  await page1.getByRole('button', { name: 'Sides' }).click();
  await page1.getByRole('link', { name: 'Garlic bread Garlic bread $8.' }).click();
  await page1.getByRole('button', { name: 'x Add to Cart' }).click();
  await page1.getByRole('button', { name: 'Open Cart' }).click();
  await page1.getByRole('link', { name: 'Checkout' }).click();
});