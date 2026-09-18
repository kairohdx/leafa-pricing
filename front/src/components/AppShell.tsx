import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Leaf, LayoutDashboard, Building2, UserRound, LogOut, Menu, X, ShoppingBag, Package, Layers3, Wrench, SlidersHorizontal, Users, History } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { errorMessage } from '../api/client'
import { Feedback } from './Feedback'

export function AppShell() {
  const { identity, logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  useEffect(() => {
    const catalogTitle = location.pathname.startsWith('/indicadores') ? 'Indicadores' : location.pathname.startsWith('/auditoria') ? 'Auditoria' : location.pathname.startsWith('/materiais') ? 'Materiais' : location.pathname.startsWith('/produtos') ? 'Produtos' : location.pathname.startsWith('/servicos') ? 'Serviços' : null
    document.title = `${catalogTitle || (location.pathname.startsWith('/vendas') ? 'Vendas' : location.pathname.startsWith('/precificacao') ? 'Precificação' : location.pathname === '/empresa' ? 'Empresa' : location.pathname.startsWith('/usuarios') ? 'Usuários' : location.pathname.startsWith('/perfil') ? 'Meu perfil' : 'Visão geral')} · Leafa Pricing`
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [location.pathname])
  if (!identity) return null
  const { user, company } = identity
  async function signOut() {
    if (busy) return
    setBusy(true); setError('')
    try { await logout() } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  function closeMenu() { dialog.current?.close(); trigger.current?.focus({ preventScroll: true }) }
  function navigation() {
    return <><div className="sidebar-brand"><span className="brand-icon"><Leaf size={24} /></span><span>leafa<small>PRICING</small></span></div>
      <p className="nav-heading">SEU NEGÓCIO</p><nav aria-label="Navegação principal">
        <NavLink end to="/" onClick={closeMenu}><LayoutDashboard size={19} />Visão geral</NavLink>
        <NavLink to="/indicadores" onClick={closeMenu}><LayoutDashboard size={19} />Indicadores</NavLink>
        <NavLink to="/materiais" onClick={closeMenu}><Package size={19} />Materiais</NavLink>
        <NavLink to="/produtos" onClick={closeMenu}><Layers3 size={19} />Produtos</NavLink>
        <NavLink to="/servicos" onClick={closeMenu}><Wrench size={19} />Serviços</NavLink>
        <NavLink to="/vendas" onClick={closeMenu}><ShoppingBag size={19} />Vendas</NavLink>
        <NavLink to="/precificacao" onClick={closeMenu}><SlidersHorizontal size={19} />Precificação</NavLink>
        <p className="nav-heading">ORGANIZAÇÃO</p><NavLink to="/empresa" onClick={closeMenu}><Building2 size={19} />Minha empresa</NavLink><NavLink to="/perfil" onClick={closeMenu}><UserRound size={19} />Meu perfil</NavLink>
        {user.role === 'admin' && <><NavLink to="/usuarios" onClick={closeMenu}><Users size={19} />Usuários</NavLink><NavLink to="/auditoria" onClick={closeMenu}><History size={19} />Auditoria</NavLink></>}
      </nav><div className="sidebar-bottom"><span className="company-mark">{company.name.charAt(0).toUpperCase()}</span><div><strong>{company.name}</strong><small>Seu espaço de trabalho</small></div></div></>
  }
  return <div className="app-shell"><a className="skip-link" href="#main-content">Ir para o conteúdo</a>
    <aside className="sidebar desktop-sidebar">{navigation()}</aside>
    <dialog ref={dialog} className="mobile-menu" aria-label="Menu de navegação" onClick={(event) => { if (event.target === event.currentTarget) closeMenu() }}><div className="sidebar"><button className="icon-button close-menu" aria-label="Fechar menu" onClick={closeMenu}><X /></button>{navigation()}</div></dialog>
    <div className="workspace"><header className="topbar"><div className="topbar-context"><button className="icon-button menu-trigger" ref={trigger} aria-label="Abrir menu" onClick={() => dialog.current?.showModal()}><Menu /></button><span className="breadcrumb">Meu espaço <span>/</span> <strong>{company.name}</strong></span></div><div className="user-controls"><span className="avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span><div className="user-caption"><strong>{user.name}</strong><small>{user.role === 'admin' ? 'Administrador' : 'Operador'}</small></div><button className="icon-button" onClick={() => void signOut()} disabled={busy} aria-label={busy ? 'Saindo' : 'Sair da conta'} title="Sair da conta"><LogOut size={19} /></button></div></header>
      <main id="main-content" tabIndex={-1} className="main-content">{error && <Feedback message={`Não foi possível encerrar a sessão. ${error}`} error />}<Outlet /></main>
      <footer className="workspace-footer"><span>Leafa Pricing</span><span>Seu negócio, bem cuidado.</span></footer>
    </div>
  </div>
}
