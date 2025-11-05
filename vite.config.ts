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
    // Ensure client build gets a stub that exports getServerFnById
    // before TanStack's own resolver overrides it.
    {
      name: 'shim-tanstack-server-fn-manifest-browser',
      apply: 'build',
      enforce: 'pre',
      load(id, options) {
        const isClient = options?.ssr === false
        if (isClient && /^\\0#tanstack-start-server-fn-manifest(\?.*)?$/.test(id)) {
          return `export async function getServerFnById(){ return null }\n`
        }
        return null
      }
    },
    tanstackStart({
      srcDirectory: 'src',
      router: {
        entry: 'app/router.tsx',
        routesDirectory: 'app/routes',
        generatedRouteTree: 'app/routeTree.gen.ts'
      }
    }),
    // Workaround: TanStack Start server core dynamically imports a virtual module
    // 'tanstack-start-injected-head-scripts:v' during SSR build. In some setups,
    // Rollup doesn’t see the core plugin resolver. Provide a minimal stub only for build.
    {
      name: 'virtual-tanstack-injected-head-scripts-stub',
      apply: 'build',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'tanstack-start-injected-head-scripts:v') return '\0tanstack-start-injected-head-scripts:v'
        return null
      },
      load(id) {
        if (id === '\0tanstack-start-injected-head-scripts:v') {
          return 'export const injectedHeadScripts = undefined\n'
        }
        return null
      }
    },
    {
      // Browser build should not include SSR-only stream helpers from router-core.
      // Shim out the module in client build to avoid node:stream import errors.
      name: 'shim-tanstack-router-ssr-for-browser',
      apply: 'build',
      enforce: 'pre',
      load(id, options) {
        const isClient = options?.ssr === false
        if (!isClient) return null
        if (/node_modules\/[@]tanstack\/router-core\/dist\/esm\/ssr\/transformStreamWithRouter\.js$/.test(id)) {
          return `export function transformStreamWithRouter(){}\nexport function transformReadableStreamWithRouter(){}\nexport function transformPipeableStreamWithRouter(){}\n`
        }
        return null
      }
    },
    {
      name: 'shim-react-router-ssr-for-browser',
      apply: 'build',
      enforce: 'pre',
      load(id, options) {
        const isClient = options?.ssr === false
        if (!isClient) return null
        if (/node_modules\/[@]tanstack\/react-router\/dist\/esm\/ssr\/renderRouterToStream\.js$/.test(id)) {
          return `export const renderRouterToStream = undefined;\n`
        }
        return null
      }
    },
    {
      name: 'shim-start-storage-context-browser',
      apply: 'build',
      enforce: 'pre',
      load(id, options) {
        const isClient = options?.ssr === false
        if (!isClient) return null
        if (/node_modules\/[@]tanstack\/start-storage-context\/dist\/esm\/async-local-storage\.js$/.test(id)) {
          return `export async function runWithStartContext(_ctx, fn){ return await fn(); }\nexport function getStartContext(){ return undefined; }\n`
        }
        return null
      }
    },
    {
      name: 'shim-start-server-core-request-response-browser',
      apply: 'build',
      enforce: 'pre',
      load(id, options) {
        const isClient = options?.ssr === false
        if (!isClient) return null
        if (/node_modules\/[@]tanstack\/start-server-core\/dist\/esm\/request-response\.js$/.test(id)) {
          return `
export function requestHandler(h){ return (req, opts)=>h(req, opts) }
export function getRequest(){ return undefined }
export function getRequestHeaders(){ return new Headers() }
export function getRequestHeader(){ return undefined }
export function getRequestIP(){ return undefined }
export function getRequestHost(){ return undefined }
export function getRequestUrl(){ return undefined }
export function getRequestProtocol(){ return undefined }
export function setResponseHeaders(){}
export function getResponseHeaders(){ return new Headers() }
export function getResponseHeader(){ return undefined }
export function setResponseHeader(){}
export function removeResponseHeader(){}
export function clearResponseHeaders(){}
export function getResponseStatus(){ return 200 }
export function setResponseStatus(){}
export function getCookies(){ return {} }
export function getCookie(){ return undefined }
export function setCookie(){}
export function deleteCookie(){}
export function useSession(){ return { data: undefined } }
export function getSession(){ return { data: undefined } }
export function updateSession(){ return {} }
export function sealSession(){ return '' }
export function unsealSession(){ return {} }
export function clearSession(){}
export function getResponse(){ return undefined }
export function getValidatedQuery(){ return {} }
`
        }
        return null
      }
    },
    {
      // In client build, rewrite server-functions-handler to use the fake manifest
      name: 'rewrite-server-functions-handler-import-for-browser',
      apply: 'build',
      enforce: 'pre',
      transform(code, id, options) {
        const isClient = options?.ssr === false
        if (!isClient) return null
        if (/node_modules\/[@]tanstack\/start-server-core\/dist\/esm\/(server-functions-handler|serializer\/ServerFunctionSerializationAdapter)\.js$/.test(id)) {
          return code.replace("from \"#tanstack-start-server-fn-manifest\"", "from \"seoagent:fake-server-fn-manifest\"")
        }
        return null
      }
    },
    {
      name: 'virtual-fake-server-fn-manifest',
      apply: 'build',
      enforce: 'pre',
      resolveId(id, _importer, options) {
        const isClient = options?.ssr === false
        if (isClient && id === 'seoagent:fake-server-fn-manifest') return '\\0seoagent:fake-server-fn-manifest'
        return null
      },
      load(id, options) {
        const isClient = options?.ssr === false
        if (isClient && id === '\\0seoagent:fake-server-fn-manifest') {
          return 'export async function getServerFnById(){ return null }\n'
        }
        return null
      }
    },
    react(),
    tailwindcss()
  ],
  optimizeDeps: {
    exclude: [
      '@tanstack/react-start',
      '@tanstack/start-client-core',
      '@tanstack/start-server-core',
      '@tanstack/router-core',
      '@tanstack/react-router',
      '@tanstack/react-router-devtools'
    ]
  },
  server: {
    port: 3000,
    host: true
  }
})
