import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Leaf, Layers3, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { ApiError, errorMessage } from '../api/client'
import { Feedback } from '../components/Feedback'
import { DemoNotice } from '../components/DemoNotice'

export function Login() {
  const auth = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState(typeof location.state?.email === 'string' ? location.state.email : '')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<string[]>([])
  useEffect(() => { document.title = 'Entrar · Leafa Pricing' }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setFields([])
    try { await auth.login(email.trim(), password) }
    catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? 'Email ou senha incorretos, ou conta indisponível.' : errorMessage(cause))
      if (cause instanceof ApiError) setFields(cause.fields.map((field) => field.field.replace(/^body\./, '')))
    } finally { setBusy(false) }
  }
  return <main className="login-layout">
    <section className="login-story" aria-label="Leafa Pricing">
      <a className="brand" href="/login"><span className="brand-icon"><Leaf size={25} /></span><span>leafa<span className="brand-sub">PRICING</span></span></a>
      <div className="story-body"><span className="eyebrow">MAIS CLAREZA. MELHORES DECISÕES.</span><h1>Seu trabalho tem valor.<br /><em>Cuide dele.</em></h1><p>Um lugar para organizar seus materiais, produtos e vendas. Mais tempo para fazer o seu negócio crescer.</p>
        <div className="story-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="leaf-tile"><Leaf size={72} strokeWidth={1} /></div><span className="floating-label"><Layers3 size={17} /> Tudo conectado</span><span className="illustration-dot" /></div>
      </div><p className="story-footer">Pequenos detalhes. Grandes possibilidades.</p>
    </section>
    <section className="login-content"><div className="login-form-wrap"><DemoNotice /><span className="eyebrow">BEM-VINDO AO LEAFA</span><h2>Bom ter você aqui.</h2><p className="muted">Entre para acessar o espaço da sua empresa.</p>
      <form onSubmit={submit} className="login-form" aria-label="Entrar na conta">
        {error && <div id="login-error"><Feedback message={error} error /></div>}
        {!error && auth.message && <p className="feedback" role="alert">{auth.message}</p>}
        {!error && location.state?.registered && <p className="feedback success-message" role="status">Empresa criada. Entre com seu email e senha.</p>}
        <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" placeholder="voce@empresa.com.br" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={fields.includes('email')} aria-describedby={fields.includes('email') ? 'login-error' : undefined} disabled={busy} />
        <label htmlFor="password">Senha</label><div className="password-field"><input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} aria-invalid={fields.includes('password')} aria-describedby={fields.includes('password') ? 'login-error' : undefined} /><button type="button" className="icon-button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
        <button className="button primary login-submit" disabled={busy} type="submit">{busy ? 'Entrando…' : 'Entrar na minha conta'}<ArrowRight size={18} aria-hidden="true" /></button>
      </form><p className="signup-link">Sua empresa ainda não está no Leafa? <Link to="/cadastro">Criar minha empresa</Link></p><div className="login-help"><ShieldCheck size={18} aria-hidden="true" /><p>Para acessar uma empresa existente, fale com o administrador.</p></div>
    </div><footer className="login-footer">Leafa Pricing <span>Feito para acompanhar seu crescimento.</span></footer></section>
  </main>
}
