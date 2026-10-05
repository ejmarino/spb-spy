import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { appVersion } from './scripts/app-version'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion())
    }
  }
})
