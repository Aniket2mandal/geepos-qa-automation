const { test, expect } = require('@playwright/test');

// Test Suite: Step 1 - Storefront Health & Modal Handling
test('verify storefront loads content and handles initial order type modal', async ({ page }) => {
    // 1. Navigate to the Kathmandu storefront page
    await page.goto('https://demo.geepos.ai/store/kathmandu', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // 2. Automatically handle and dismiss the mandatory "Delivery / Pickup" modal if it appears
    try {
        // Wait until the order-type modal appears.
        const modalMessage = page.getByText(
            'Please select one of the order types to continue.',
            { exact: true }
        );

        await expect(modalMessage).toBeVisible({ timeout: 15000 });

        // "PickUp" matches the modal button, not the background "PICKUP".
        const pickupButton = page.getByRole('button', {
            name: 'PickUp',
            exact: true,
        });

        await expect(pickupButton).toBeVisible();
        await pickupButton.click();

        // Confirm the modal was dismissed.
        await expect(modalMessage).toBeHidden();
    } catch (e) {
        console.log('No modal appeared, proceeding with storefront verification.');
    }

    // 3. Wait for the core root elements/buttons to render on the page
    await page.waitForTimeout(3000);

    // 4. Verify that interactive buttons are successfully rendered, confirming a healthy page load
    const buttons = page.locator('button');
    const count = await buttons.count();
    console.log(`Found ${count} buttons on the storefront.`);
    expect(count).toBeGreaterThan(0);
});