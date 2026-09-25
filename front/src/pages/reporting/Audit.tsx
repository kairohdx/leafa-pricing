import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useResource, type Page } from '../../api/hooks'
import { useAuth } from '../../auth/AuthProvider'
import { Feedback } from '../../components/Feedback'
import { PageHeading } from '../../components/Forms'
import { Pagination } from '../../components/Pagination'
import { LoadError } from '../catalog/Shared'
import { dateText } from '../trading/validation'
import { ReportFilters, type Filter } from './Filters'

type AuditEvent = { id: string; company_id: string; actor_user_id: string | null; action: string; entity_type: string; entity_id: string; changes: Record<string, unknown>; request_id: string | null; occurred_at: string }
const fields: Filter[] = [
  { key: 'actor_user_id', label: 'Ator (ID do usuário)', advanced: true, maxLength: 36 },
  { key: 'entity_type', label: 'Tipo de entidade', maxLength: 60, options: { sale: 'Venda', material: 'Material', product: 'Produto', service: 'Serviço', pricing_rule: 'Regra', company: 'Empresa', user: 'Usuário', material_package: 'Embalagem' } },
  { key: 'entity_id', label: 'ID da entidade', advanced: true, maxLength: 36 },
  { key: 'action', label: 'Ação', maxLength: 60, options: { create: 'Cadastro', update: 'Edição', archive: 'Arquivamento', restore: 'Restauração', status_change: 'Mudança de status' } },
  { key: 'request_id', label: 'Request ID', advanced: true, maxLength: 100 },
]

function auditLabel(value: string) { return fields.find(field => field.options?.[value])?.options?.[value] || value }

export function AuditPage() {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const query = new URLSearchParams({ page: params.get('page') || '1', page_size: '10' })
  for (const key of ['start', 'end', ...fields.map((field) => field.key)]) if (params.get(key)) query.set(key, params.get(key)!)
  const result = useResource<Page<AuditEvent>>(`/audit-events?${query}`)
  return <><PageHeading section="ORGANIZAÇÃO" title="Auditoria" description={`Histórico da empresa, em ${identity!.company.timezone}. Filtros combinados; somente consulta.`}><button className="button secondary" disabled={result.loading} onClick={result.reload}>Atualizar eventos</button></PageHeading>
    <ReportFilters params={params} onChange={setParams} fields={fields} />
    {result.loading && <Feedback message="Carregando eventos…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>{!result.data.items.length && <div className="empty-state"><h2>Nenhum evento encontrado.</h2><p>Altere os filtros para consultar outros registros.</p></div>}<div className="catalog-grid">{result.data.items.map((event) => <Link className="catalog-card" key={event.id} to={`/auditoria/${event.id}?${params}`}><h2>{auditLabel(event.entity_type)} · {auditLabel(event.action)}</h2><p>{dateText(event.occurred_at, identity!.company.timezone)}</p></Link>)}</div><Pagination page={result.data} onChange={(page) => { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next) }} /></>}
  </>
}

export function AuditDetailPage() {
  const { id } = useParams()
  const { identity } = useAuth()
  const location = useLocation()
  const result = useResource<AuditEvent>(`/audit-events/${encodeURIComponent(id || '')}`)
  const event = result.data
  return <><PageHeading section="AUDITORIA" title="Detalhe do evento" description="Registro histórico persistido pela API, sem edição ou exclusão."><Link className="button secondary" to={`/auditoria${location.search}`}>Voltar aos eventos</Link></PageHeading>
    {result.loading && <Feedback message="Carregando evento…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {event && <><section className="detail-card"><h2>{auditLabel(event.entity_type)} · {auditLabel(event.action)}</h2><dl className="details">{[
      ['Data', `${dateText(event.occurred_at, identity!.company.timezone)} (${identity!.company.timezone})`], ['Instante UTC', event.occurred_at], ['Evento', event.id], ['Empresa', event.company_id], ['Ator', event.actor_user_id || 'Não informado'], ['Entidade', event.entity_id], ['Request ID', event.request_id || 'Não informado'],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <section className="detail-card"><h2>Alterações registradas</h2>{Object.keys(event.changes).length === 0 && <p>Nenhuma alteração detalhada disponível.</p>}{Object.entries(event.changes).map(([key, value]) => <section key={key} className="trading-section"><h3>{key === 'before' ? 'Antes' : key === 'after' ? 'Depois' : key}</h3><pre className="json-view">{JSON.stringify(value, null, 2)}</pre></section>)}<p className="muted">Campos protegidos são apresentados como [REDACTED] pela API. Login e logout não fazem parte deste histórico de negócio.</p></section>
    </>}
  </>
}
