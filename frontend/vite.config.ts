import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

function errorLoggerPlugin(): Plugin {
  return {
    name: 'error-logger',
    transformIndexHtml(html) {
      const script = `
        <script type="module">
          if (import.meta.hot) {
            import.meta.hot.on('vite:error', (payload) => {
              console.error('[VITE-HMR-ERROR]', payload.err?.message || payload)
              if (payload.err?.stack) console.error(payload.err.stack)
            })
            import.meta.hot.on('vite:beforeUpdate', (payload) => {
              console.log('[VITE-HMR] Updating:', payload.updates.map(u => u.path).join(', '))
            })
          }
          window.addEventListener('error', (e) => {
            console.error('[UI-ERROR]', e.message, '\\n', e.filename + ':' + e.lineno)
          })
          window.addEventListener('unhandledrejection', (e) => {
            console.error('[UI-UNHANDLED-PROMISE]', e.reason)
          })
        </script>
      `
      return html.replace('</head>', `${script}\n</head>`)
    },
    configureServer(server) {
      server.ws.on('error', (err: unknown) => {
        console.error('[VITE-WS-ERROR]', (err as Error).message)
      })
    },
  }
}

const logger = createLogger('info', { prefix: '[vite]' })

export default defineConfig({
  base: './',
  plugins: [errorLoggerPlugin(), react(), tailwindcss()],
  clearScreen: false,
  customLogger: logger,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
    hmr: true,
  },
})
