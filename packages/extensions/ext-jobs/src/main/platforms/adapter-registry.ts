/**
 * Community platform adapter registry.
 *
 * Community-contributed platform adapters are published as npm packages following
 * the convention:
 *   - Package name: @openorbit/<platform>  (e.g. @openorbit/glassdoor)
 *   - keywords: ["openorbit-adapter"]
 *   - Optional "openorbit-platform" field: the hostname pattern  (e.g. "glassdoor.com")
 *
 * Usage:
 *   const adapters = await discoverAdapters()
 *   // adapters = [{ name: '@openorbit/glassdoor', version: '1.0.0', ... }]
 */

import { readdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface AdapterMeta {
  /** Full package name, e.g. "@openorbit/glassdoor" */
  name: string
  version: string
  description?: string
  /** Hostname this adapter targets, from package.json "openorbit-platform" field */
  platform?: string
}

/**
 * Discover installed community adapter packages by scanning node_modules/@openorbit/*.
 * Returns only packages that declare "openorbit-adapter" in their keywords.
 */
export async function discoverAdapters(nodeModulesRoot?: string): Promise<AdapterMeta[]> {
  const root = nodeModulesRoot ?? process.cwd()
  const scopeDir = join(root, 'node_modules', '@openorbit')

  if (!existsSync(scopeDir)) return []

  const adapters: AdapterMeta[] = []

  let packages: string[]
  try {
    packages = readdirSync(scopeDir)
  } catch {
    return []
  }

  for (const pkg of packages) {
    const pkgJsonPath = join(scopeDir, pkg, 'package.json')
    if (!existsSync(pkgJsonPath)) continue

    let pkgJson: Record<string, unknown>
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as Record<string, unknown>
    } catch {
      continue
    }

    const keywords = pkgJson['keywords']
    if (!Array.isArray(keywords) || !keywords.includes('openorbit-adapter')) continue

    adapters.push({
      name: `@openorbit/${pkg}`,
      version: typeof pkgJson['version'] === 'string' ? pkgJson['version'] : 'unknown',
      description: typeof pkgJson['description'] === 'string' ? pkgJson['description'] : undefined,
      platform:
        typeof pkgJson['openorbit-platform'] === 'string'
          ? pkgJson['openorbit-platform']
          : undefined
    })
  }

  return adapters
}
