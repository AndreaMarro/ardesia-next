import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, retries: 0, workers: 1,
  reporter: [['list'], ['json', {outputFile: 'artifacts/e2e.json'}]],
  use: {baseURL: 'http://127.0.0.1:4173', trace: 'off', screenshot: 'only-on-failure'},
  projects: [
    {name: 'desktop-chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 960}}},
    {name: 'mobile-chromium', testIgnore: '**/pointer-desktop.spec.ts', use: {...devices['Pixel 7']}}
  ],
  webServer: {command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 60000}
});
