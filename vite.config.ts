import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this project at
  // https://navarshabeer768-arch.github.io/clothing-saas-erp/ (a "project
  // page", not a user/org root page), so every asset URL must be prefixed
  // with the repo name. If you ever move to a custom domain or a
  // <username>.github.io root-page repo, change this back to '/'.
  base: '/clothing-saas-erp/',
})
