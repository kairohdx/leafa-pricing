import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { Feedback } from './components/Feedback'
import { Login } from './pages/Login'
import { NotFound, Overview } from './pages/Workspace'
import { CompanyPage } from './pages/account/CompanyPage'
import { ProfilePage, PasswordPage } from './pages/account/ProfilePage'
import { Register } from './pages/account/Register'
import { SessionsPage } from './pages/account/SessionsPage'
import { NewUserPage, UserDetailPage, UsersPage } from './pages/account/UsersPage'
import { CatalogLayout } from './pages/catalog/Units'
import { CatalogList } from './pages/catalog/Shared'
import { CatalogDetailPage, NewCatalogPage } from './pages/catalog/CatalogPages'
import { PackagePage } from './pages/catalog/Packages'
import { catalog, type CatalogKind } from './pages/catalog/types'
import { NewRulePage, RuleDetailPage, RulesPage } from './pages/trading/Rules'
import { NewSalePage, SaleDetailPage, SalesPage } from './pages/trading/Sales'
import { AnalyticsPage } from './pages/reporting/Analytics'
import { AuditPage, AuditDetailPage } from './pages/reporting/Audit'

function Protected() {
  const auth = useAuth()
  const location = useLocation()
  return auth.status === 'authenticated' ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
function LoginRoute() {
  const auth = useAuth()
  const location = useLocation()
  const from: unknown = location.state?.from
  const target = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/'
  return auth.status === 'authenticated' ? <Navigate to={target} replace /> : <Login />
}
function AdminOnly() {
  const { identity } = useAuth()
  return identity?.user.role === 'admin' ? <Outlet /> : <section className="detail-card"><h1>Acesso restrito</h1><p>Esta área está disponível somente para administradores da empresa.</p></section>
}
export function App() {
  const auth = useAuth()
  if (auth.status === 'loading') return <main className="standalone"><Feedback message="Preparando seu espaço…" /></main>
  if (auth.status === 'error') return <main className="standalone"><h1>Não foi possível carregar seu espaço.</h1><Feedback message={auth.message} error /><button className="button primary" onClick={auth.retry}>Tentar novamente</button></main>
  return <Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route path="/cadastro" element={auth.status === 'authenticated' ? <Navigate to="/" replace /> : <Register />} />
    <Route element={<Protected />}><Route element={<AppShell />}>
      <Route index element={<Overview />} />
      <Route path="indicadores" element={<AnalyticsPage />} />
      <Route path="empresa" element={<CompanyPage />} />
      <Route path="perfil" element={<ProfilePage />} />
      <Route path="perfil/senha" element={<PasswordPage />} />
      <Route path="perfil/sessoes" element={<SessionsPage />} />
      <Route path="precificacao" element={<RulesPage />} />
      <Route path="precificacao/nova" element={<NewRulePage />} />
      <Route path="precificacao/:id" element={<RuleDetailPage />} />
      <Route element={<CatalogLayout />}>
        <Route path="vendas" element={<SalesPage />} />
        <Route path="vendas/nova" element={<NewSalePage />} />
        <Route path="vendas/:id" element={<SaleDetailPage />} />
        {(Object.keys(catalog) as CatalogKind[]).map((kind) => {
          const path = catalog[kind].route.slice(1)
          return <Route key={kind}>
            <Route path={path} element={<CatalogList kind={kind} />} />
            <Route path={`${path}/novo`} element={<NewCatalogPage kind={kind} key={kind} />} />
            <Route path={`${path}/:id`} element={<CatalogDetailPage kind={kind} />} />
          </Route>
        })}
        <Route path="materiais/:id/embalagens/nova" element={<PackagePage />} />
        <Route path="materiais/:id/embalagens/:packageId" element={<PackagePage />} />
      </Route>
      <Route element={<AdminOnly />}>
        <Route path="auditoria" element={<AuditPage />} />
        <Route path="auditoria/:id" element={<AuditDetailPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="usuarios/novo" element={<NewUserPage />} />
        <Route path="usuarios/:id" element={<UserDetailPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Route></Route>
  </Routes>
}
