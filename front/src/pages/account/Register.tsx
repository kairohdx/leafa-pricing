import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaf, ArrowLeft } from 'lucide-react'
import { request } from '../../api/client'
import { useFormAction } from '../../api/hooks'
import { emptyPerson, Field, FormFeedback, PersonFields } from '../../components/Forms'
import { CompanyFields, emptyCompany } from './CompanyFields'
import { DemoNotice } from '../../components/DemoNotice'

export function Register() {
  const [company, setCompany] = useState(emptyCompany)
  const [admin, setAdmin] = useState(emptyPerson)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const form = useFormAction()
  const navigate = useNavigate()
  async function submit(event: FormEvent) {
    event.preventDefault()
    setMismatch(password !== confirmation)
    if (password !== confirmation) return
    await form.run(async () => {
      await request('/companies', { method: 'POST', body: JSON.stringify({ company, admin: { ...admin, password } }) })
      navigate('/login', { replace: true, state: { registered: true, email: admin.email } })
    }, { conflict: 'Este identificador de empresa ou email já está cadastrado. Revise os dados.' })
  }
  return <main className="registration-page">
    <DemoNotice />
    <header className="registration-header"><Link className="brand" to="/login"><span className="brand-icon"><Leaf /></span>leafa</Link><Link className="text-link" to="/login"><ArrowLeft size={16} />Já tenho uma conta</Link></header>
    <div className="registration-intro"><span className="eyebrow">SEU NEGÓCIO COMEÇA AQUI</span><h1>Crie seu espaço no Leafa.</h1><p className="muted">Cadastre sua empresa e a primeira conta de administrador.</p></div>
    <form className="detail-card registration-form" onSubmit={submit}>
      <FormFeedback state={form} />
      <fieldset disabled={form.busy}><legend>Dados da empresa</legend><CompanyFields value={company} onChange={setCompany} errors={form.fields} prefix="company." /></fieldset>
      <fieldset disabled={form.busy}><legend>Seu acesso de administrador</legend><PersonFields value={admin} onChange={setAdmin} errors={form.fields} prefix="admin." />
        <div className="form-grid"><Field label="Senha" type="password" autoComplete="new-password" required minLength={8} maxLength={128} hint="Use de 8 a 128 caracteres." value={password} error={form.fields['admin.password']} onChange={(event) => { setPassword(event.target.value); setMismatch(false) }} /><Field label="Confirmar senha" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} error={mismatch ? 'As senhas precisam ser iguais.' : undefined} onChange={(event) => { setConfirmation(event.target.value); setMismatch(false) }} /></div>
      </fieldset>
      <div className="form-actions"><p className="muted">Após o cadastro, entre com seu email e senha.</p><button className="button primary" type="submit" disabled={form.busy}>{form.busy ? 'Criando empresa…' : 'Criar minha empresa'}</button></div>
    </form>
  </main>
}
