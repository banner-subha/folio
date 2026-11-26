import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Port is fixed because src-tauri/tauri.conf.json points devUrl at it.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // WebView2 is evergreen Chromium, so skip down-level transforms.
  build: { target: 'chrome120' },
  server: {
    port: 4700,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
