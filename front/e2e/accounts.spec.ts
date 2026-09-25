import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const password = 'initial-password-123'
async function register(request: APIRequestContext, tag: string) {
  const suffix = `${tag}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const email = `${suffix}@example.com`
  const response = await request.post('/api/companies', { data: {
    company: { name: `Empresa ${tag}`, slug: suffix },
    admin: { name: 'Maria Admin', username: 'maria', email, password },
  } })
  expect(response.status()).toBe(201)
  const login = await request.post('/api/auth/login', { data: { email, password } })
  const { access_token: token } = await login.json()
  return { email, token: token as string }
}
async function login(page: Page, email: string, secret = password) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(secret)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  // Login may restore a protected destination left by the previous session.
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible()
}

test('cadastro público, empresa, perfil e troca de senha', async ({ page, request }, testInfo) => {
  const suffix = `public-${testInfo.project.name}-${Date.now()}`
  const email = `${suffix}@example.com`
  await page.goto('/login')
  await page.getByRole('link', { name: 'Criar minha empresa' }).click()
  await page.getByLabel('Nome da empresa', { exact: true }).fill('Ateliê Novo')
  await page.getByLabel('Endereço da empresa no sistema').fill(suffix)
  await page.getByLabel('Nome completo').fill('Joana Teste')
  await page.getByLabel('Nome de usuário').fill('joana')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar minha empresa' }).click()
  await expect(page.getByRole('status')).toContainText('Empresa criada')
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByRole('heading', { name: /Olá, Joana/ })).toBeVisible()
  await page.goto('/empresa')
  await page.getByRole('button', { name: 'Editar empresa' }).click()
  await page.getByLabel('Nome da empresa', { exact: true }).fill('Ateliê Atualizado')
  await page.getByLabel('Moeda', { exact: true }).selectOption('EUR')
  await page.getByLabel('Fuso horário').selectOption('Europe/Lisbon')
  await page.getByRole('button', { name: 'Salvar empresa' }).click()
  await expect(page.getByRole('heading', { name: 'Ateliê Atualizado' })).toBeVisible()
  await expect(page.getByText('EUR', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ateliê Atualizado' })).toBeVisible()
  await page.goto('/perfil')
  await page.getByLabel('Nome completo').fill('Joana Atualizada')
  await page.getByLabel('Telefone').fill('11999999999')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.screenshot({ path: testInfo.outputPath('perfil.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'Alterar senha', exact: true }).click()
  await page.getByLabel('Senha atual').fill('wrong-password')
  await page.getByLabel('Nova senha', { exact: true }).fill('new-password-123')
  await page.getByLabel('Confirmar nova senha').fill('new-password-123')
  await page.getByRole('button', { name: 'Alterar senha e encerrar sessões' }).click()
  await expect(page.getByRole('alert')).toContainText('senha atual está incorreta')
  await page.getByLabel('Senha atual').fill(password)
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('leafa.session')!).access_token as string)
  await page.getByRole('button', { name: 'Alterar senha e encerrar sessões' }).click()
  await expect(page.getByRole('heading', { name: 'Bom ter você aqui.' })).toBeVisible()
  expect((await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401)
  await login(page, email, 'new-password-123')
})

test('usuários: cadastro, busca, paginação, acesso e redefinição de senha', async ({ page, request }, testInfo) => {
  test.setTimeout(60_000)
  const admin = await register(request, `users-${testInfo.project.name}`)
  const headers = { Authorization: `Bearer ${admin.token}` }
  // Enough records to exercise real server pagination instead of a local array.
  for (let index = 0; index < 10; index++) {
    const created = await request.post('/api/users', { headers, data: {
      name: `Equipe ${String(index).padStart(2, '0')}`, username: `equipe${index}`,
      email: `equipe${index}-${admin.email}`, password,
    } })
    expect(created.status()).toBe(201)
  }
  await login(page, admin.email)
  await page.goto('/usuarios')
  await expect(page.getByLabel('Paginação')).toContainText('11 registros')
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page.getByLabel('Paginação')).toContainText('Página 2 de 2')
  await page.getByRole('link', { name: 'Novo usuário' }).click()
  const employeeEmail = `operador-${admin.email}`
  await page.getByLabel('Nome completo').fill('Novo Operador')
  await page.getByLabel('Nome de usuário').fill('novo-operador')
  await page.getByLabel('Email', { exact: true }).fill(employeeEmail)
  await page.getByLabel('Senha inicial').fill(password)
  await page.getByRole('button', { name: 'Criar usuário', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Novo Operador', exact: true })).toBeVisible()
  await page.getByLabel('Nome completo').fill('Pessoa Editada')
  await page.getByRole('button', { name: 'Salvar usuário' }).click()
  await expect(page.getByRole('heading', { name: 'Pessoa Editada', exact: true })).toBeVisible()
  const sessionResponse = await request.post('/api/auth/login', { data: { email: employeeEmail, password } })
  const oldToken = (await sessionResponse.json()).access_token
  await page.getByLabel('Papel', { exact: true }).selectOption('admin')
  await page.getByRole('button', { name: 'Aplicar alterações de acesso' }).click()
  await page.getByRole('dialog').getByRole('button').last().click()
  await expect(page.getByRole('status').filter({ hasText: 'Acesso atualizado' })).toBeVisible()
  expect((await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } })).status()).toBe(401)
  await page.getByLabel('Situação', { exact: true }).selectOption('false')
  await page.getByRole('button', { name: 'Aplicar alterações de acesso' }).click()
  await page.getByRole('dialog').getByRole('button').last().click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect((await request.post('/api/auth/login', { data: { email: employeeEmail, password } })).status()).toBe(401)
  await page.getByLabel('Situação', { exact: true }).selectOption('true')
  await page.getByRole('button', { name: 'Aplicar alterações de acesso' }).click()
  await page.getByRole('dialog').getByRole('button').last().click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByLabel('Nova senha do usuário').fill('reset-password-123')
  await page.getByLabel('Confirmar senha do usuário').fill('reset-password-123')
  await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click()
  await page.getByRole('dialog').getByRole('button').last().click()
  await expect(page.getByRole('status').filter({ hasText: 'Senha redefinida' })).toBeVisible()
  expect((await request.post('/api/auth/login', { data: { email: employeeEmail, password: 'reset-password-123' } })).status()).toBe(200)
  await page.getByRole('link', { name: 'Voltar aos usuários' }).click()
  await page.getByLabel('Buscar usuário').fill('Pessoa Editada')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByLabel('Paginação')).toContainText('1 registro')
  await expect(page.getByLabel('Paginação')).toContainText('Página 1 de 1')
  await page.getByLabel('Buscar usuário').fill('não-existe')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nenhum resultado para estes filtros.' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpar' }).click()
  await page.screenshot({ path: testInfo.outputPath('usuarios.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('operador, isolamento e revogação da sessão atual', async ({ page, request }, testInfo) => {
  const first = await register(request, `first-${testInfo.project.name}`)
  const second = await register(request, `second-${testInfo.project.name}`)
  const foreign = await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${second.token}` } })
  const foreignId = (await foreign.json()).id
  const create = await request.post('/api/users', { headers: { Authorization: `Bearer ${first.token}` }, data: {
    name: 'Operador Teste', username: 'operador', email: `op-${first.email}`, password,
  } })
  expect(create.status()).toBe(201)
  await login(page, first.email)
  await page.goto(`/usuarios/${foreignId}`)
  await expect(page.getByRole('alert')).toContainText('Não encontramos este registro')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await login(page, `op-${first.email}`)
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
  await page.goto('/empresa')
  await expect(page.getByRole('heading', { name: 'Minha empresa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar empresa' })).toHaveCount(0)
  await page.goto('/perfil/sessoes')
  await expect(page.getByRole('button', { name: 'Revogar sessão' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Revogar sessão' }).click()
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Minhas sessões' })).toBeVisible()
  await page.getByRole('button', { name: 'Revogar sessão' }).click()
  await page.getByRole('dialog').getByRole('button').last().click()
  await expect(page.getByRole('heading', { name: 'Bom ter você aqui.' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('leafa.session'))).toBeNull()
})
