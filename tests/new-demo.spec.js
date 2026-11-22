import { test, expect } from '@playwright/test';

const BAD = /deal|offer|most liked/i;
const NOT_CATEGORY = /^(log ?in|sign ?(in|up)|call|directions|hours|book|home|contact|about|menu|cart|checkout|skip)/i;
const TIME = /\d{1,2}:\d{2}\s?[ap]m/i;

const isVisible = (locator, timeout = 5000) =>
  locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);

// true if the button is inside a deal/offer section or says deal/offer
const looksLikeDeal = (btn) =>
  btn.evaluate((el) => {
    const bad = /deal|offer/i;
    let text = `${el.innerText} ${el.getAttribute('aria-label') ?? ''}`;
    let n = el;
    for (let up = 0; up < 4 && n && n !== document.body; up++, n = n.parentElement) {
      text += ` ${n.id} ${n.className?.toString?.() ?? ''}`;
    }
    if (bad.test(text)) return true;
    let heading = null;
    for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) heading = h;
      else break;
    }
    return !!heading && bad.test(heading.innerText);
  });

test('test', async ({ page }) => {
  await page.goto('https://new-demo.geepos.ai/store/kathmandu');

  // ---- Order popup: Pickup (if present) -> Tomorrow (if present) -> confirm ----
  const orderPopup = page.getByRole('dialog').first();
  const scope = (await isVisible(orderPopup, 4000)) ? orderPopup : page;

  // Pickup toggle, only if present
  const pickupToggle = scope
    .getByRole('radio', { name: /^pick ?up$/i })
    .or(scope.getByRole('tab', { name: /^pick ?up$/i }))
    .or(scope.getByRole('button', { name: /^pick ?up$/i }))
    .first();
  if (await isVisible(pickupToggle, 3000)) {
    await pickupToggle.click();
  }

  // Tomorrow, only if present (any date, first available time)
  const tomorrow = scope.getByRole('radio', { name: /^tomorrow/i }).first();
  if (await isVisible(tomorrow, 2000)) {
    await tomorrow.click();
    const slot = scope.getByRole('radio', { name: TIME }).first();
    if (await isVisible(slot, 3000)) await slot.click();
  }

  // Confirm button: "Pickup · as soon as possible" or "Pickup · Tomorrow 2:45 am"
  const confirm = scope.getByRole('button', { name: /^pick ?up\s*[·•-]/i }).first();
  if (await isVisible(confirm, 3000)) {
    await confirm.click();
  }

  // If the popup is still open, close it
  if (await isVisible(orderPopup, 1500)) {
    const browse = orderPopup.getByRole('button', { name: /just browse/i });
    if (await isVisible(browse, 1500)) await browse.click();
  }

  // ---- Category links (same-page links only), skipping Deals / Offers / Most liked ----
  const storePath = new URL(page.url()).pathname;
  const linkLoc = page.getByRole('link');
  const linkCount = Math.min(await linkLoc.count(), 60);
  const categories = [];
  for (let i = 0; i < linkCount; i++) {
    const link = linkLoc.nth(i);
    if (!(await link.isVisible().catch(() => false))) continue;

    // skip links that leave this page (logo, home, other pages)
    const href = await link.getAttribute('href').catch(() => null);
    if (href) {
      const target = new URL(href, page.url());
      if (target.pathname !== storePath) continue;
    }

    const text = (await link.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!text || text.length > 30 || /\$/.test(text)) continue;
    if (BAD.test(text) || NOT_CATEGORY.test(text)) continue;
    if (!categories.includes(text)) categories.push(text);
  }
  if (categories.length === 0) categories.push(null);   // no categories: use what is on screen

  const dialog = page.getByRole('dialog').first();
  const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
  const priced = page
    .getByRole('button')
    .filter({ hasText: /\$\s*\d/ })
    .filter({ hasNotText: /add to cart|checkout|open cart|view cart/i });

  const tried = [];
  let added = false;

  for (const category of categories.slice(0, 10)) {
    if (added) break;

    if (category) {
      const link = page.getByRole('link', { name: category, exact: true }).first();
      await link.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);

      // safety: if we left the store page by mistake, go back and try the next category
      if (new URL(page.url()).pathname !== storePath) {
        tried.push(`[${category}] -> left the store page, went back`);
        await page.goBack();
        await page.waitForTimeout(800);
        continue;
      }
    }

    // Item buttons that are currently on screen (the clicked category scrolls into view)
    const viewportHeight = page.viewportSize()?.height ?? 720;
    const count = Math.min(await priced.count(), 60);
    const onScreen = [];
    for (let i = 0; i < count && onScreen.length < 6; i++) {
      const box = await priced.nth(i).boundingBox().catch(() => null);
      if (box && box.y >= 0 && box.y + box.height <= viewportHeight) onScreen.push(i);
    }

    for (const i of onScreen) {
      const btn = priced.nth(i);
      const label = (await btn.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 50);

      if (await looksLikeDeal(btn).catch(() => true)) {
        tried.push(`[${category}] #${i} "${label}" -> skipped (deal/offer)`);
        continue;
      }
      try {
        await btn.click({ timeout: 3000 });
      } catch {
        tried.push(`[${category}] #${i} "${label}" -> click failed`);
        continue;
      }
      if (!(await isVisible(addToCart, 3000))) {
        tried.push(`[${category}] #${i} "${label}" -> no "Add to cart" appeared`);
        await page.keyboard.press('Escape');
        continue;
      }
      console.log(`picked [${category}] "${label}"`);
      added = true;
      break;
    }
  }

  if (!added) console.log('TRIED:\n' + tried.join('\n'));
  expect(added, 'no non-deal menu item opened').toBeTruthy();

  // Add-on inside the item (e.g. "Add lettuce", "Add chilly"): click the first one, if any
  const addOnButton = (s) =>
    s.getByRole('button', { name: /^add\b/i })
      .filter({ hasNotText: /add to cart/i })
      .first();

  let addOn = addOnButton(dialog);
  if (!(await isVisible(addOn, 1500))) addOn = addOnButton(page);
  if (await isVisible(addOn, 1500)) {
    await addOn.click();
  }

  // Required choices (size etc.): first option in each group inside the dialog, if any
  if (await isVisible(dialog, 500)) {
    const groups = await dialog
      .locator('input[type=radio]')
      .evaluateAll(els => [...new Set(els.map(e => e.name))]);
    for (const g of groups) {
      await dialog.locator(`input[type=radio][name="${g}"]`).first().check({ force: true });
    }
  }

  await addToCart.click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  // ---- "Almost there" popup: click Log in ----
  const almostThere = page.getByText('Almost there');
  const popupShown = await isVisible(almostThere, 8000);
  console.log('Almost there popup shown:', popupShown);

  if (popupShown) {
    // The popup sits on top, so its Log in is the last one in the page (the header one is behind it)
    const loginBtn = page
      .getByRole('button', { name: 'Log in', exact: true })
      .or(page.getByRole('link', { name: 'Log in', exact: true }))
      .last();
    await loginBtn.click();

    // Must reach the login page, otherwise fail
    await page.waitForURL(/login/, { timeout: 10000 });
  }

  // ---- Login page: fill and submit ----
  const password = page.locator('input[type=password]').first();
  if (await isVisible(password, 8000)) {
    const phone = process.env.TEST_PHONE;
    const pass = process.env.TEST_PASSWORD;
    expect(phone && pass, 'Set TEST_PHONE and TEST_PASSWORD').toBeTruthy();

    await page
      .getByRole('textbox', { name: /mobile|phone|email|username/i })
      .first()
      .fill(phone);
    await password.fill(pass);

    const form = page.locator('form').filter({ has: password });
    const submit = (await form.count())
      ? form.getByRole('button', { name: /log ?in|sign ?in/i }).first()
      : page.getByRole('button', { name: /log ?in|sign ?in/i }).last();
    await submit.click();

    // Stop here: report the result without failing the test
    const reachedCheckout = await page
      .waitForURL((url) => url.pathname.includes('checkout'), { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    console.log(
      reachedCheckout
        ? 'Login OK: reached checkout'
        : 'Login did not reach checkout (wrong credentials or an error). Stopping here.'
    );
  } else {
    expect(page.url(), 'Neither a login page nor checkout was reached').toMatch(/checkout/i);
  }
});