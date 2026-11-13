import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('./scripts/serve.mjs', import.meta.url));
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174/gm-finance/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: `"${process.execPath}" "${server}" --dir dist --base /gm-finance --port 4174`,
    url: 'http://127.0.0.1:4174/gm-finance/',
    reuseExistingServer: false
  }
});
