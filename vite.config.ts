import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import react from '@vitejs/plugin-react'
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
    nitro(),
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    host: true
  }
})
