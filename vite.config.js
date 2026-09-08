import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    open: false,
    proxy: {
      '/identitytoolkit.googleapis.com': 'http://127.0.0.1:9099',
      '/securetoken.googleapis.com': 'http://127.0.0.1:9099',
      '/google.firestore.v1.Firestore': 'http://127.0.0.1:8080',
      '/v1/projects/demo-3kong-online/databases': 'http://127.0.0.1:8080',
      '/demo-3kong-online/us-central1': 'http://127.0.0.1:5001'
    }
  }
})
