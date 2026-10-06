// playwright setup for the smoke test against the deployed site, no local server:
//   LIVE_URL=https://<user>.github.io/<repo-name>/ npm run smoke
import { defineConfig } from '@playwright/test';

const url = process.env.LIVE_URL;
if (!url) throw new Error('set LIVE_URL, e.g. LIVE_URL=https://you.github.io/emberwing/ npm run smoke');

export default defineConfig({
  testDir: 'tests-live',
  timeout: 300_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: url.endsWith('/') ? url : url + '/',
    viewport: { width: 1920, height: 1080 },
  },
});
