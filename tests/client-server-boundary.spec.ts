import { describe, it, expect } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const CLIENT_ROOTS = [
  'src/app/routes',
  'src/pages',
  'src/features',
  'src/blocks',
  'src/common/ui'
]

const CLIENT_EXTENSIONS = new Set(['.ts', '.tsx'])

const SERVER_NAMESPACE_CHECKS: Array<{ test: (specifier: string) => boolean; reason: string }> = [
  { test: (s) => s.startsWith('@app/api-utils'), reason: '@app/api-utils is server-only' },
  { test: (s) => s.startsWith('@server/'), reason: '@server namespace is server-only' },
  { test: (s) => s.includes('/server/'), reason: 'Server directories must not leak into client bundles' },
  { test: (s) => s.includes('.server'), reason: 'Server-suffixed modules must stay on the server' },
  { test: (s) => s.startsWith('@common/infra/'), reason: '@common/infra contains Node-specific infrastructure' },
  { test: (s) => s.startsWith('@common/realtime/'), reason: '@common/realtime hub is server-only' },
  { test: (s) => s.startsWith('@common/providers/impl/'), reason: 'Provider impls depend on server resources' },
  { test: (s) => s === 'postgres' || s.startsWith('postgres/'), reason: 'postgres client is server-only' },
  { test: (s) => s.startsWith('node:'), reason: 'Node built-ins are unavailable in the browser' }
]

const STATIC_IMPORT_REGEX = /import(?:[^'"`]*?from)?\s*['"`]([^'"`]+)['"`]/g

const projectRoot = process.cwd()

describe('client/server boundaries', () => {
  it('client-visible modules avoid server-only imports', async () => {
    const files = await collectClientFiles()
    const violations: Array<{ file: string; specifier: string; reason: string }> = []

    for (const file of files) {
      const contents = await readFile(file, 'utf8')
      const specs = new Set<string>()

      for (const match of contents.matchAll(STATIC_IMPORT_REGEX)) {
        specs.add(match[1])
      }

      for (const specifier of specs) {
        const reason = violationReason(specifier)
        if (reason) {
          violations.push({ file: path.relative(projectRoot, file), specifier, reason })
        }
      }
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `${v.file} → ${v.specifier} (${v.reason})`)
        .join('\n')
      throw new Error(`Server-only modules leaked into client bundle:\n${details}`)
    }

    expect(violations.length).toBe(0)
  })
})

async function collectClientFiles(): Promise<string[]> {
  const files: string[] = []
  for (const root of CLIENT_ROOTS) {
    const rootPath = path.join(projectRoot, root)
    await walk(rootPath, files)
  }
  return files.filter(shouldIncludeFile)
}

async function walk(dir: string, out: string[]) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(fullPath, out)
    } else {
      out.push(fullPath)
    }
  }
}

function shouldIncludeFile(filePath: string): boolean {
  if (!CLIENT_EXTENSIONS.has(path.extname(filePath))) return false
  if (filePath.endsWith('.d.ts')) return false

  const relative = path.relative(projectRoot, filePath)

  if (relative.includes('/app/routes/api/')) return false
  if (relative.includes('/server/')) return false
  if (relative.includes('/worker/')) return false
  if (relative.includes('/tests/')) return false
  if (relative.includes('/__tests__/')) return false
  if (relative.includes('/__mocks__/')) return false
  if (relative.includes('/fixtures/')) return false
  if (relative.includes('.test.') || relative.includes('.spec.')) return false
  if (relative.includes('.server.')) return false

  if (relative.startsWith('src/features/')) {
    if (!relative.includes('/client/') && !relative.includes('/shared/')) {
      return false
    }
  }

  return true
}

function violationReason(specifier: string): string | null {
  for (const check of SERVER_NAMESPACE_CHECKS) {
    if (check.test(specifier)) {
      return check.reason
    }
  }

  if (specifier.startsWith('.') || specifier.startsWith('..')) {
    if (specifier.includes('/server/') || specifier.includes('.server')) {
      return 'Relative import points to server-only module'
    }
  }

  return null
}
