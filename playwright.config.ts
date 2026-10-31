import {defineConfig, devices} from '@playwright/test';
import {assertRemoteInvocation, resolveE2ETarget} from './e2e/target.ts';
const target = resolveE2ETarget();
assertRemoteInvocation(target);
if (target.mode === 'remote') process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, retries: 0, workers: 1,
  ...(target.mode === 'remote' ? {testMatch: '**/remote-continuity.spec.ts', globalSetup: './tools/remote-playwright-setup.mjs'} : {}),
  outputDir: target.outputDir,
  reporter: [['list'], ['json', {outputFile: target.reportPath}]],
  use: {baseURL: target.origin, trace: 'off', screenshot: 'only-on-failure',
    ...(target.mode === 'remote' ? {serviceWorkers: 'block' as const} : {})},
  projects: [
    {name: 'desktop-chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 960}}},
    {name: 'mobile-chromium', testIgnore: '**/pointer-desktop.spec.ts', use: {...devices['Pixel 7']}}
  ],
  ...(target.mode === 'local' ? {
    webServer: {command: 'npm run preview', url: target.origin, reuseExistingServer: false, timeout: 60000}
  } : {})
});
