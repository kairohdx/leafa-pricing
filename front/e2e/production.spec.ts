import { expect, test } from '@playwright/test'

test('servidor de produção: SPA, assets ausentes, saúde e proxy sem fallback HTML', async ({ request }) => {
  test.skip(!process.env.E2E_BASE_URL, 'Validação específica do Nginx no Compose descartável.')
  const health = await request.get('/health.json')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })
  const deepLink = await request.get('/vendas/id-de-rota-direta')
  expect(deepLink.status()).toBe(200)
  expect(await deepLink.text()).toContain('<div id="root">')
  expect(deepLink.headers()['cache-control']).toContain('no-cache')
  expect((await request.get('/assets/missing.js')).status()).toBe(404)
  const api = await request.get('/api/health')
  expect((await api.json()).status).toBe('ok')
  const missing = await request.get('/api/does-not-exist')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/json')
})
