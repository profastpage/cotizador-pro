import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        superadmin: resolve(__dirname, 'src/superadmin.html'),
        app: resolve(__dirname, 'src/app.html'),
        view: resolve(__dirname, 'src/view.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
