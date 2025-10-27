#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

type CliCommand = 'help' | 'version' | 'ping'

export async function runCli(args: string[] = process.argv.slice(2)) {
  const command = normalizeCommand(args[0])
  switch (command) {
    case 'ping': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/health', baseUrl).toString()
      try {
        const res = await fetch(url, { method: 'GET' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { ok?: boolean; version?: string; service?: string }
        const dv = typeof data?.version === 'string' ? data.version : 'unknown'
        console.log(`health ok: ${data?.ok ? 'true' : 'false'} service: ${data?.service ?? 'seo-agent'} v${dv}`)
      } catch (err) {
        console.error(`health check failed: ${(err as Error)?.message ?? String(err)}`)
        process.exitCode = 1
      }
      return
    }
    case 'version': {
      const pkg = await readPackageJson()
      console.log(`${pkg.name ?? 'seo-agent'} v${pkg.version ?? '0.0.0'}`)
      return
    }
    case 'help':
    default: {
      printHelp()
    }
  }
}

function normalizeCommand(input?: string): CliCommand {
  if (!input) return 'help'
  if (input === '--version' || input === '-v') return 'version'
  if (input === '--help' || input === '-h') return 'help'
  if (input.toLowerCase() === 'version') return 'version'
  if (input.toLowerCase() === 'ping') return 'ping'
  return 'help'
}

async function readPackageJson(): Promise<Record<string, unknown>> {
  try {
    const pkgUrl = await resolvePackageJsonUrl()
    const contents = await readFile(pkgUrl, 'utf-8')
    return JSON.parse(contents)
  } catch {
    return {}
  }
}

async function resolvePackageJsonUrl() {
  const currentFile = fileURLToPath(import.meta.url)
  const root = dirname(dirname(currentFile))
  return pathToFileURL(join(root, 'package.json'))
}

function printHelp() {
  console.log(
    [
      'SEO Agent CLI',
      '',
      'Usage:',
      '  seo [command]',
      '',
      'Commands:',
      '  help        Show this help output',
      '  version     Print the current package version',
      '  ping        Call /api/health on SEO_AGENT_BASE_URL (default http://localhost:5173)',
      '',
      'Examples:',
      '  seo version',
      '  seo ping',
      '  seo help'
    ].join('\n')
  )
}

const cliImportMeta = import.meta as ImportMeta & { main?: boolean }

if (cliImportMeta.main) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
