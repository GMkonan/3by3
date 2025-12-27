import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // Use relative paths for assets so it works in subdirectories (like on GitHub Pages)
  build: {
    outDir: 'dist',
  }
})
