import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it.each(['', '/api', 'http://api:8000', 'https://user:secret@example.com', 'https://example.com?secret=value', 'https://example.com#fragment'])('recusa configuração inválida de Static Site: %s', (url) => {
  const result = spawnSync(process.execPath, [resolve('scripts/check-hosted-env.mjs')], { env: { ...process.env, VITE_API_URL: url }, encoding: 'utf8' })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Set VITE_API_URL')
  expect(result.stderr).not.toContain('secret=value')
})

it('aceita URL pública HTTPS, inclusive caminho-base', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/check-hosted-env.mjs')], { env: { ...process.env, VITE_API_URL: 'https://example.com/api' }, encoding: 'utf8' })
  expect(result.status).toBe(0)
})
