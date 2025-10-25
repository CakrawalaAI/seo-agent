import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { devtools } from '@tanstack/devtools-vite'
import { nitro } from 'nitro/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({
      projects: ['./tsconfig.json']
    }),
    tanstackStart(),
    nitro(),
    react({
      babel: {
        plugins: [
          [
            'babel-plugin-react-compiler',
            {
              target: '19'
            }
          ]
        ]
      }
    }),
    tailwindcss()
  ]
})
