import { expect, test } from '@playwright/test'

test('login real, recarga, menu, logout e isolamento entre contas', async ({ page, request }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const password = 'test-only-password-123'
  const accounts = ['Ana', 'Bia'].map((name) => ({ name, email: `${name.toLowerCase()}-${suffix}@example.com`, company: `Ateliê ${name} ${suffix}` }))
  for (const account of accounts) {
    const response = await request.post('/api/companies', { data: {
      company: { name: account.company, slug: `${account.name.toLowerCase()}-${suffix}` },
      admin: { name: account.name, username: account.name.toLowerCase(), email: account.email, password },
    } })
    expect(response.status()).toBe(201)
  }
  await page.goto('/empresa')
  await expect(page.getByRole('heading', { name: 'Bom ter você aqui.' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true })
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email)
  await page.getByLabel('Senha', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByRole('alert')).toContainText('Email ou senha incorretos')
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByRole('heading', { name: accounts[0].company })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: accounts[0].company })).toBeVisible()
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('link', { name: 'Visão geral' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused()
  } else await page.getByRole('link', { name: 'Visão geral' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Ana .' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true })
  const oldToken = await page.evaluate(() => JSON.parse(sessionStorage.getItem('leafa.session')!).access_token as string)
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você aqui.' })).toBeVisible()
  expect((await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } })).status()).toBe(401)
  await page.getByLabel('Email', { exact: true }).fill(accounts[1].email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByRole('heading', { name: 'Olá, Bia .' })).toBeVisible()
  await expect(page.getByText(accounts[0].company, { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você aqui.' })).toBeVisible()
})
