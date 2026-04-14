import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('package scripts', () => {
  it('uses cross-env for Windows-safe VITE port configuration', () => {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
      devDependencies?: Record<string, string>
    }

    expect(packageJson.devDependencies?.['cross-env']).toBeTruthy()
    expect(packageJson.scripts.dev).toContain('cross-env VITE_DEV_PORT=5175 VITE_PREVIEW_PORT=4175')
    expect(packageJson.scripts.preview).toContain('cross-env VITE_DEV_PORT=5175 VITE_PREVIEW_PORT=4175')
    expect(packageJson.scripts.dev).not.toMatch(/^VITE_DEV_PORT=/)
    expect(packageJson.scripts.preview).not.toMatch(/^VITE_DEV_PORT=/)
  })
})
