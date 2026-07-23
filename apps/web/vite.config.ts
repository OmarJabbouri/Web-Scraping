import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Tailwind v4 is wired in as a Vite plugin — no PostCSS config or tailwind.config.js needed;
  // the theme lives in CSS (`src/index.css`). See https://tailwindcss.com/docs/installation/vite.
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev proxy: the UI calls same-origin `/api/*` and Vite forwards it to the API on :3000, so
    // there are no CORS or absolute-URL concerns in dev. In prod, nginx does the same forwarding.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
