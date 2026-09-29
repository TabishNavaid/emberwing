import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo-name>/. The deploy workflow
// sets BASE_PATH=/<repo-name>/. The default './' (relative paths) also works
// for any static host, a subfolder, or opening dist/ from `npm run preview`.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  server: { host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
