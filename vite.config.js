import { defineConfig } from 'vite';

// github pages lives under /<repo-name>/ and the workflow sets BASE_PATH for that.
// './' works everywhere else (any static host, a subfolder, npm run preview)
export default defineConfig({
  base: process.env.BASE_PATH || './',
  server: { host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
