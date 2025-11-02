import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ['./tsconfig.json']
    }),
    tanstackStart({
      srcDirectory: 'src',
      router: {
        entry: 'app/router.tsx',
        routesDirectory: 'app/routes',
        generatedRouteTree: 'app/routeTree.gen.ts'
      }
    }),
    react(),
    tailwindcss()
  ],
  optimizeDeps: {
    exclude: [
      '@tanstack/react-start',
      '@tanstack/start-client-core',
      '@tanstack/start-server-core',
      '@tanstack/router-core'
    ]
  },
  ssr: {
    noExternal: [
      '@tanstack/react-start',
      '@tanstack/start-client-core',
      '@tanstack/start-server-core'
    ]
  },
  server: {
    port: 3000,
    host: true
  }
})
