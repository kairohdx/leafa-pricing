import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Search, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import type { User } from '../../auth/types'
import { changes, useFormAction, useResource, type Page } from '../../api/hooks'
import { emptyPerson, Field, FormFeedback, PageHeading, PersonFields, SelectField, type PersonDraft } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { ConfirmButton } from '../../components/ConfirmButton'

export function UsersPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const active = params.get('active') || ''
  const requestedPage = Number(params.get('page') || '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 2_147_483_647 ? requestedPage : 1
  const query = new URLSearchParams({ page: String(page), page_size: '10' })
  if (search) query.set('search', search)
  if (active === 'true' || active === 'false') query.set('active', active)
  const result = useResource<Page<User>>(`/users?${query}`)
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = new URLSearchParams()
    const text = String(data.get('search') || '').trim()
    if (text) next.set('search', text)
    if (data.get('active')) next.set('active', String(data.get('active')))
    setParams(next)
  }
  const suffix = params.size ? `?${params}` : ''
  return <><PageHeading section="ORGANIZAÇÃO" title="Usuários" description="Pessoas que fazem parte da sua empresa."><Link className="button primary" to={`/usuarios/novo${suffix}`}><Plus size={18} />Novo usuário</Link></PageHeading>
    <form className="filter-bar" onSubmit={filter} key={`${search}:${active}`} aria-label="Filtrar usuários">
      <Field label="Buscar usuário" name="search" placeholder="Nome, email ou usuário" defaultValue={search} maxLength={255} />
      <div className="form-field"><label htmlFor="user-active">Situação</label><select id="user-active" name="active" defaultValue={active}><option value="">Todas</option><option value="true">Ativos</option><option value="false">Inativos</option></select></div>
      <button className="button secondary" type="submit"><Search size={17} />Filtrar</button>{(search || active) && <button className="button secondary" type="button" onClick={() => setParams({})}>Limpar</button>}
    </form>
    {result.loading && <Feedback message="Carregando usuários…" />}
    {result.error && <><Feedback message={result.error} error /><button className="button secondary" onClick={result.reload}>Tentar novamente</button></>}
    {result.data && <>{result.data.items.length === 0 ? <div className="empty-state"><h2>{search || active ? 'Nenhum resultado para estes filtros.' : 'Nenhum usuário nesta página.'}</h2><p>Altere os filtros ou volte para uma página anterior.</p></div> :
      <div className="users-list">{result.data.items.map((user) => <Link key={user.id} className="user-record" to={`/usuarios/${user.id}${suffix}`}>
        <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div className="user-record-name"><strong>{user.name}</strong><span>{user.email}</span></div><span className="user-record-role">{user.role === 'admin' ? 'Administrador' : 'Operador'}</span><span className={`record-status ${user.is_active ? 'is-active' : ''}`}>{user.is_active ? 'Ativo' : 'Inativo'}</span><ArrowUpRight size={17} aria-hidden="true" />
      </Link>)}</div>}
      <Pagination page={result.data} onChange={(next) => { const updated = new URLSearchParams(params); updated.set('page', String(next)); setParams(updated) }} />
    </>}
  </>
}

export function NewUserPage() {
  const { api } = useAuth()
  const [draft, setDraft] = useState(emptyPerson)
  const [role, setRole] = useState('operator')
  const [password, setPassword] = useState('')
  const form = useFormAction()
  const navigate = useNavigate()
  const location = useLocation()
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const created = await api<User>('/users', { method: 'POST', body: JSON.stringify({ ...draft, password, role }) })
      navigate(`/usuarios/${created.id}${location.search}`, { replace: true, state: { created: true } })
    }, { conflict: 'Este email ou nome de usuário já está em uso. Revise os dados.' })
  }
  return <><PageHeading section="ORGANIZAÇÃO" title="Novo usuário" description="Crie uma conta na sua empresa."><Link className="button secondary" to={`/usuarios${location.search}`}>Voltar aos usuários</Link></PageHeading>
    <form className="detail-card" onSubmit={submit}><FormFeedback state={form} /><fieldset disabled={form.busy}><PersonFields value={draft} onChange={setDraft} errors={form.fields} />
      <div className="form-grid"><Field label="Senha inicial" type="password" autoComplete="new-password" minLength={8} maxLength={128} required hint="Use de 8 a 128 caracteres." value={password} error={form.fields.password} onChange={(event) => setPassword(event.target.value)} /><SelectField label="Papel" value={role} onChange={setRole}><option value="operator">Operador</option><option value="admin">Administrador</option></SelectField></div>
    </fieldset><div className="form-actions"><button className="button primary" disabled={form.busy}>{form.busy ? 'Criando…' : 'Criar usuário'}</button></div></form>
  </>
}

function AccessEditor({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const { api } = useAuth()
  const [role, setRole] = useState<string>(user.role)
  const [active, setActive] = useState(String(user.is_active))
  const [saved, setSaved] = useState(false)
  const changed = role !== user.role || active !== String(user.is_active)
  async function save() {
    const updated = await api<User>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(changes({ role: user.role as string, is_active: user.is_active }, { role, is_active: active === 'true' })) })
    onSaved(updated); setSaved(true)
  }
  return <section className="detail-card"><h2>Permissões e acesso</h2><p className="section-description">Mudanças de papel ou situação encerram todas as sessões deste usuário. Reativar a conta exige novo login.</p>
    {saved && <p className="feedback success-message" role="status">Acesso atualizado. As sessões anteriores foram revogadas.</p>}
    <div className="form-grid"><SelectField label="Papel" value={role} onChange={(value) => { setRole(value); setSaved(false) }}><option value="operator">Operador</option><option value="admin">Administrador</option></SelectField><SelectField label="Situação" value={active} onChange={(value) => { setActive(value); setSaved(false) }}><option value="true">Ativo</option><option value="false">Inativo</option></SelectField></div>
    <div className="form-actions"><ConfirmButton label="Aplicar alterações de acesso" title="Alterar o acesso deste usuário?" description={`O acesso de ${user.name} será atualizado para ${role === 'admin' ? 'administrador' : 'operador'}, ${active === 'true' ? 'ativo' : 'inativo'}. Todas as sessões desse usuário serão encerradas.`} disabled={!changed} onConfirm={save} /></div>
  </section>
}

function ResetPassword({ user }: { user: User }) {
  const { api } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saved, setSaved] = useState(false)
  const valid = password.length >= 8 && password.length <= 128 && password === confirmation
  async function reset() {
    await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ password }) })
    setPassword(''); setConfirmation(''); setSaved(true)
  }
  return <section className="detail-card"><h2>Redefinir senha</h2><p className="section-description">A nova senha substituirá a atual e encerrará todas as sessões deste usuário.</p>
    {saved && <p className="feedback success-message" role="status">Senha redefinida e sessões revogadas.</p>}
    <div className="form-grid"><Field label="Nova senha do usuário" type="password" autoComplete="new-password" minLength={8} maxLength={128} hint="Use de 8 a 128 caracteres." value={password} onChange={(event) => { setPassword(event.target.value); setSaved(false) }} /><Field label="Confirmar senha do usuário" type="password" autoComplete="new-password" maxLength={128} value={confirmation} error={confirmation && confirmation !== password ? 'As senhas precisam ser iguais.' : undefined} onChange={(event) => { setConfirmation(event.target.value); setSaved(false) }} /></div>
    <div className="form-actions"><ConfirmButton label="Redefinir senha" title="Redefinir a senha deste usuário?" description={`A senha de ${user.name} será substituída. Todas as sessões serão encerradas e será necessário entrar com a nova senha.`} disabled={!valid} onConfirm={reset} /></div>
  </section>
}

function UserEditor({ initialUser }: { initialUser: User }) {
  const { api, identity, updateIdentity } = useAuth()
  const [user, setUser] = useState(initialUser)
  const [initial, setInitial] = useState<PersonDraft>({ name: user.name, username: user.username, email: user.email, phone: user.phone })
  const [draft, setDraft] = useState(initial)
  const form = useFormAction()
  const location = useLocation()
  const self = user.id === identity!.user.id
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const updated = await api<User>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(changes(initial, draft)) })
      setUser(updated)
      const next = { name: updated.name, username: updated.username, email: updated.email, phone: updated.phone }
      setInitial(next); setDraft(next)
      if (self) updateIdentity({ user: updated })
    }, { conflict: 'Este email ou nome de usuário já está em uso. Revise os dados.', success: 'Usuário atualizado.' })
  }
  return <><PageHeading section="ORGANIZAÇÃO" title={user.name} description={`${user.role === 'admin' ? 'Administrador' : 'Operador'} · ${user.is_active ? 'Ativo' : 'Inativo'}`}><Link className="button secondary" to={`/usuarios${location.search}`}>Voltar aos usuários</Link></PageHeading>
    {location.state?.created && <p className="feedback success-message" role="status">Usuário criado.</p>}
    <div className="stacked-cards"><form className="detail-card" onSubmit={submit} aria-label="Editar usuário"><h2>Dados do usuário</h2><FormFeedback state={form} /><fieldset disabled={form.busy}><PersonFields value={draft} onChange={setDraft} errors={form.fields} /></fieldset><div className="form-actions"><button className="button primary" disabled={form.busy}>{form.busy ? 'Salvando…' : 'Salvar usuário'}</button></div></form>
      {self ? <section className="detail-card"><h2>Esta é a sua conta</h2><p className="section-description">Outro administrador deve alterar seu papel ou desativar seu acesso. Para trocar sua senha, confirme a senha atual no seu perfil.</p><Link className="button secondary" to="/perfil/senha">Alterar minha senha</Link></section> : <><AccessEditor user={user} onSaved={setUser} /><ResetPassword user={user} /></>}
    </div>
  </>
}

export function UserDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const result = useResource<User>(`/users/${encodeURIComponent(id || '')}`)
  if (result.loading) return <Feedback message="Carregando usuário…" />
  if (result.error) return <section><Feedback message={result.error} error /><div className="form-actions"><Link className="button secondary" to={`/usuarios${location.search}`}>Voltar aos usuários</Link><button className="button secondary" onClick={result.reload}>Tentar novamente</button></div></section>
  return result.data ? <UserEditor initialUser={result.data} key={result.data.id} /> : null
}
