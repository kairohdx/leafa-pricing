import { ArrowUpRight, Building2, Leaf, UserRound, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function Overview() {
  const { identity } = useAuth()
  if (!identity) return null
  return <><div className="page-heading"><div><span className="eyebrow">SEU ESPAÇO DE TRABALHO</span><h1>Olá, {identity.user.name.split(' ')[0]} <span className="greeting-dot">.</span></h1><p className="muted">Bom trabalho começa com tudo no lugar.</p></div><span className="status-pill"><span />Conta conectada</span></div>
    <section className="welcome-card"><div><span className="eyebrow">CRESÇA COM ORGANIZAÇÃO</span><h2>Um novo olhar<br />para o seu negócio.</h2><p>Seu espaço está pronto. Confira os dados da empresa e as informações do seu perfil para começar.</p><Link className="button dark" to="/empresa">Conhecer meu espaço<ArrowUpRight size={18} /></Link></div><div className="welcome-art" aria-hidden="true"><div /><Leaf size={130} strokeWidth={0.8} /></div></section>
    <div className="section-heading"><h2>Seu ponto de partida</h2><span>Informações da conta</span></div><div className="quick-grid"><Link className="quick-card" to="/empresa"><span className="card-icon"><Building2 /></span><ArrowUpRight className="card-arrow" size={20} /><h3>Minha empresa</h3><p>{identity.company.name}</p><span className="text-link">Ver informações</span></Link><Link className="quick-card" to="/perfil"><span className="card-icon"><UserRound /></span><ArrowUpRight className="card-arrow" size={20} /><h3>Meu perfil</h3><p>Seus dados e nível de acesso.</p><span className="text-link">Acessar perfil</span></Link></div>
    <section className="next-note"><Sprout size={24} /><div><h3>Acompanhe seus resultados</h3><p>Consulte as vendas concluídas por período e moeda. Administradores também podem acompanhar o histórico na auditoria.</p><Link className="text-link" to="/indicadores">Ver indicadores</Link></div></section>
  </>
}

export function NotFound() {
  return <section className="standalone"><span className="eyebrow">PÁGINA NÃO ENCONTRADA</span><h1>Este caminho não existe.</h1><p className="muted">Volte ao seu espaço para continuar.</p><Link className="button primary" to="/">Voltar ao início</Link></section>
}

