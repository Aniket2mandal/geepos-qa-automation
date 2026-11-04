// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Maximum total duration for each test: 60 seconds.
  timeout: 60000,

  fullyParallel: true,

  // Prevent test.only from accidentally limiting CI runs.
  forbidOnly: !!process.env.CI,

  // Retry failed tests twice on GitHub Actions.
  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  use: {
    // Make the browser behave like it does on your PC.
    // GitHub runners use UTC, which can change what the site shows
    // (store hours, "Today"/"Tomorrow", available time slots).
    timezoneId: 'Asia/Kathmandu',
    locale: 'en-US',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],

        // Small delay locally; no artificial delay on GitHub.
        launchOptions: {
          slowMo: process.env.CI ? 0 : 300,
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
});