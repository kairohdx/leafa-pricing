import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, MonitorSmartphone } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import type { User } from '../../auth/types'
import { changes, useFormAction } from '../../api/hooks'
import { Field, FormFeedback, PageHeading, PersonFields, type PersonDraft } from '../../components/Forms'

export function ProfilePage() {
  const { identity, api, updateIdentity } = useAuth()
  const user = identity!.user
  const [initial, setInitial] = useState<PersonDraft>({ name: user.name, username: user.username, email: user.email, phone: user.phone })
  const [draft, setDraft] = useState(initial)
  const form = useFormAction()
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const updated = await api<User>('/users/me', { method: 'PATCH', body: JSON.stringify(changes(initial, draft)) })
      updateIdentity({ user: updated })
      const next = { name: updated.name, username: updated.username, email: updated.email, phone: updated.phone }
      setInitial(next); setDraft(next)
    }, { conflict: 'Este email ou nome de usuário já está em uso. Revise os dados.', success: 'Perfil atualizado.' })
  }
  return <><PageHeading section="SUA CONTA" title="Meu perfil" description="Seus dados e a segurança do seu acesso." />
    <form className="detail-card" onSubmit={submit} aria-label="Editar perfil"><h2>Informações pessoais</h2><p className="section-description">{identity!.company.name} · {user.role === 'admin' ? 'Administrador' : 'Operador'}</p><FormFeedback state={form} />
      <fieldset disabled={form.busy}><PersonFields value={draft} onChange={setDraft} errors={form.fields} /></fieldset>
      <div className="form-actions"><button className="button primary" disabled={form.busy}>{form.busy ? 'Salvando…' : 'Salvar perfil'}</button></div>
    </form>
    <div className="account-links"><Link className="button secondary" to="/perfil/senha"><KeyRound size={18} />Alterar senha</Link><Link className="button secondary" to="/perfil/sessoes"><MonitorSmartphone size={18} />Minhas sessões</Link></div>
  </>
}

export function PasswordPage() {
  const { api, endSession } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const form = useFormAction()
  async function submit(event: FormEvent) {
    event.preventDefault()
    setMismatch(password !== confirmation)
    if (password !== confirmation) return
    await form.run(async () => {
      await api('/users/me/password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: password }) })
      endSession('Senha alterada. Entre novamente com sua nova senha.')
    }, { forbidden: 'A senha atual está incorreta. Confira e tente novamente.' })
  }
  return <><PageHeading section="SEGURANÇA" title="Alterar senha" description="Escolha uma nova senha para sua conta."><Link className="button secondary" to="/perfil">Voltar ao perfil</Link></PageHeading>
    <form className="detail-card narrow-card" onSubmit={submit}><FormFeedback state={form} />
      <fieldset disabled={form.busy}><Field label="Senha atual" type="password" required autoComplete="current-password" value={current} error={form.fields.current_password} onChange={(event) => setCurrent(event.target.value)} />
        <Field label="Nova senha" type="password" required autoComplete="new-password" minLength={8} maxLength={128} value={password} hint="Use de 8 a 128 caracteres." error={form.fields.new_password} onChange={(event) => { setPassword(event.target.value); setMismatch(false) }} />
        <Field label="Confirmar nova senha" type="password" required autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} error={mismatch ? 'As senhas precisam ser iguais.' : undefined} onChange={(event) => { setConfirmation(event.target.value); setMismatch(false) }} />
      </fieldset><p className="info-note">Ao alterar sua senha, todas as suas sessões serão encerradas, inclusive esta. Será necessário entrar novamente.</p>
      <div className="form-actions"><button className="button primary" disabled={form.busy}>{form.busy ? 'Alterando…' : 'Alterar senha e encerrar sessões'}</button></div>
    </form>
  </>
}
