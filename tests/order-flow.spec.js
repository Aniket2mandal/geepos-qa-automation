import { test, expect } from '@playwright/test';
import { stores } from './stores.js';

const BAD = /deal|offer/i;

const isVisible = (locator, timeout = 8000) =>
  locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);

// Index of the first item that is not a deal/offer (-1 if none)
const pickIndex = (items) =>
  items.evaluateAll((els, src) => {
    const bad = new RegExp(src, 'i');
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      let text = `${el.innerText} ${el.getAttribute('href') ?? ''}`;
      let n = el;
      for (let up = 0; up < 4 && n && n !== document.body; up++, n = n.parentElement) {
        text += ` ${n.id} ${n.className?.toString?.() ?? ''} ${n.getAttribute('aria-label') ?? ''}`;
      }
      if (bad.test(text)) continue;
      let heading = null;
      for (const h of headings) {
        if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) heading = h;
        else break;
      }
      if (heading && bad.test(heading.innerText)) continue;
      return i;
    }
    return -1;
  }, BAD.source);

for (const store of stores) {
  test(`order flow: ${store.name}`, async ({ page }) => {
    let shop = page;
    await page.goto(store.url);

    const pickUp = (p) => p.getByRole('button', { name: 'PickUp', exact: true });

    // If we are on a landing page, click "Order Now" first (only if it exists)
    const orderNow = page
      .getByRole('link', { name: /order now/i })
      .or(page.getByRole('button', { name: /order now/i }))
      .locator('visible=true')
      .first();

    if (!(await isVisible(pickUp(page), 3000)) && (await isVisible(orderNow, 3000))) {
      const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
      await orderNow.click();
      const popup = await popupPromise;
      if (popup) {
        shop = popup;
        await shop.waitForLoadState();
      }
    }

    // Click PickUp only if the site has it
    if (await isVisible(pickUp(shop), 8000)) {
      await pickUp(shop).click();
    }

    // Schedule only if the site asks for it
    const tomorrow = shop.getByText('TOMORROW');
    if (await isVisible(tomorrow, 5000)) {
      await tomorrow.click();
      await shop.getByText(/\d\d:\d\d [AP]M/).first().click();
      await shop.getByRole('button', { name: 'Confirm Schedule' }).click();
    }

    // Find priced menu items
    const allItems = store.itemSelector
      ? shop.locator(store.itemSelector)
      : shop.getByRole('link').filter({ hasText: /\$\s*\d/ });
    await allItems.first().waitFor({ timeout: 15000 });

    let goodIndex = await pickIndex(allItems);

    // Fallback: the page may open on a Deals tab, so try the other tabs
    if (goodIndex < 0) {
      const tabs = shop.getByRole('tab').or(shop.locator('nav button'));
      const count = Math.min(await tabs.count(), 10);
      for (let t = 0; t < count && goodIndex < 0; t++) {
        const tab = tabs.nth(t);
        const label = (await tab.innerText().catch(() => '')).trim();
        if (!label || /deal|offer|cart|checkout|pickup|delivery|login|sign/i.test(label)) continue;
        await tab.click({ timeout: 3000 }).catch(() => {});
        await shop.waitForTimeout(1000);
        goodIndex = await pickIndex(allItems);
      }
    }

    console.log(`[${store.name}] items found: ${await allItems.count()}, picking #${goodIndex}`);
    expect(goodIndex, 'no non-deal item found').toBeGreaterThanOrEqual(0);
    await allItems.nth(goodIndex).click();

    // If the item asks for a choice (size etc.), pick the first option in each group
    const names = await shop
      .locator('input[type=radio]')
      .evaluateAll(els => [...new Set(els.map(e => e.name))]);
    for (const n of names) {
      await shop.locator(`input[type=radio][name="${n}"]`).first().check({ force: true });
    }

    await shop.getByRole('button', { name: /Add to Cart/ }).click();
    await shop.getByRole('button', { name: 'Open Cart' }).click();
    await shop.getByRole('link', { name: 'Checkout' }).click();

    // Log in only if the site asks for it (credentials come from environment variables)
    const password = shop.locator('input[type=password]');
    if (await isVisible(password, 8000)) {
      const prefix = store.loginEnv ?? 'TEST';
      const phone = process.env[`${prefix}_PHONE`];
      const pass = process.env[`${prefix}_PASSWORD`];
      expect(phone && pass, `Set ${prefix}_PHONE and ${prefix}_PASSWORD`).toBeTruthy();

      await shop
        .locator('#phoneNo')
        .or(shop.getByRole('textbox', { name: /phone|mobile|email|username/i }))
        .first()
        .fill(phone);
      await password.fill(pass);
      await shop.getByRole('button', { name: /log ?in|sign ?in/i }).click();
    }

    await expect(shop).toHaveURL(/checkout/i); // adjust if needed
  });
}