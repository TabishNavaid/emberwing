import { defineConfig } from '@playwright/test';

// Tests run against the production build (same files GitHub Pages serves).
export default defineConfig({
  testDir: 'tests',
  timeout: 150_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
