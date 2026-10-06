// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

const systemChromium = '/bin/chromium';
const hasSystemChromium = fs.existsSync(systemChromium);

module.exports = defineConfig({
  testDir: './tests/playwright',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    launchOptions: hasSystemChromium ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || systemChromium,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    } : undefined
  },
  webServer: {
    command: 'python3 -m http.server 5000',
    port: 5000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
