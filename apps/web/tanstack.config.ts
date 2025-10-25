// @ts-nocheck
import { defineConfig } from '@tanstack/router-generator/config'

export default defineConfig({
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
  extensions: ['tsx', 'ts'],
  watch: process.env.NODE_ENV === 'development'
})
