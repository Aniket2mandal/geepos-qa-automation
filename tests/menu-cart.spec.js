// import { test, expect } from '@playwright/test';

// test('test', async ({ page }) => {
//   await page.goto('https://demo.geepos.ai/store/kathmandu');
//   await page.getByRole('button', { name: 'PickUp', exact: true }).click();
//   await page.getByRole('button', { name: 'Pizza' }).click();
//   await page.locator('#bbq-pizza').click();
//   await page.getByText('LRG', { exact: true }).click();
//   await page.getByText('LRG', { exact: true }).check();
//   await page.getByRole('button', { name: 'add' }).nth(2).click();
//   await page.locator('div:nth-child(3) > .flex.flex-wrap > div > button:nth-child(3)').first().click();
//   await page.locator('div:nth-child(3) > .flex.flex-wrap > .p-2.rounded-lg.flex.items-center.gap-1.bg-black > button:nth-child(3)').click();
//   await page.locator('div:nth-child(3) > .flex.flex-wrap > .p-2.rounded-lg.flex.items-center.gap-1.bg-black > button').first().click();
//   await page.getByText('tomato1').click();
//   await page.getByRole('button', { name: 'x Add to Cart' }).click();
//   await page.getByRole('button', { name: 'Open Cart' }).click();
//   await page.getByRole('link', { name: 'Checkout' }).click();
// });