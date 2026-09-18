import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useResource, type Page } from '../../api/hooks'
import { PageHeading } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { ConfirmButton } from '../../components/ConfirmButton'
import { Pagination } from '../../components/Pagination'

type Session = { id: string; user_id: string; created_at: string; expires_at: string; revoked_at: string | null }

export function SessionsPage() {
  const { api, identity } = useAuth()
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const result = useResource<Page<Session>>(`/users/me/sessions?page=${page}&page_size=10`)
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: identity!.company.timezone })
  async function revoke(id: string) {
    await api(`/users/me/sessions/${id}`, { method: 'DELETE' })
    // The API does not expose the current session ID. Probe auth after every revocation.
    await api('/auth/me')
    setMessage('Sessão revogada.'); result.reload()
  }
  return <><PageHeading section="SEGURANÇA" title="Minhas sessões" description="Consulte e revogue os acessos da sua conta."><Link className="button secondary" to="/perfil">Voltar ao perfil</Link></PageHeading>
    <p className="info-note">Datas no fuso {identity!.company.timezone}. Revogar a sessão usada nesta aba encerrará seu acesso. A lista inclui sessões expiradas e revogadas.</p>
    {message && <p className="feedback success-message" role="status">{message}</p>}
    {result.loading && <Feedback message="Carregando sessões…" />}
    {result.error && <><Feedback message={result.error} error /><button className="button secondary" onClick={result.reload}>Tentar novamente</button></>}
    {result.data && <><div className="record-list">{result.data.items.map((session) => {
      const state = session.revoked_at ? 'Revogada' : Date.parse(session.expires_at) <= now ? 'Expirada' : 'Ativa'
      return <article className="record-card" key={session.id}><div className="record-main"><h2>Sessão de {formatter.format(new Date(session.created_at))}</h2><span className={`record-status ${state === 'Ativa' ? 'is-active' : ''}`}>{state}</span></div>
        <dl className="session-details"><div><dt>Identificador</dt><dd className="session-id">{session.id}</dd></div><div><dt>Expira em</dt><dd>{formatter.format(new Date(session.expires_at))}</dd></div>{session.revoked_at && <div><dt>Revogada em</dt><dd>{formatter.format(new Date(session.revoked_at))}</dd></div>}</dl>
        {state === 'Ativa' && <ConfirmButton label="Revogar sessão" title="Revogar este acesso?" description="A sessão selecionada perderá acesso imediatamente. Se for a sessão desta aba, você será direcionado ao login." onConfirm={() => revoke(session.id)} />}
      </article>
    })}</div>{result.data.items.length === 0 && <p className="empty-state">Nenhuma sessão nesta página.</p>}<Pagination page={result.data} onChange={setPage} /></>}
  </>
}
