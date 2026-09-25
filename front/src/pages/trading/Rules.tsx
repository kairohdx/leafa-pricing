import { UnsavedChanges } from '../../components/UnsavedChanges'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { changes, useFormAction, useResource, type Page } from '../../api/hooks'
import { useAuth } from '../../auth/AuthProvider'
import { Field, FormFeedback, PageHeading } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { ConfirmButton } from '../../components/ConfirmButton'
import { ArchiveButton, LoadError, TextArea } from '../catalog/Shared'
import { RuleSimulator, StrategyFields, strategyName, strategies, parameterError } from './PricingCalculator'
import type { Rule } from './types'

export function RulesPage() {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const query = new URLSearchParams({ page: params.get('page') || '1', page_size: '10', search: params.get('search') || '', archived: String(params.get('archived') === 'true') })
  const result = useResource<Page<Rule>>(`/pricing-rules?${query}`)
  return <><PageHeading section="PRECIFICAÇÃO" title="Regras de precificação" description="Configure como os custos se transformam em preços sugeridos.">{identity?.user.role === 'admin' && <Link className="button primary" to="/precificacao/nova">Nova regra</Link>}</PageHeading>
    <form className="filter-bar" key={`${query.get('search')}:${query.get('archived')}`} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setParams({ search: String(data.get('search') || ''), archived: String(data.get('archived')) }) }}>
      <Field label="Buscar regras" name="search" defaultValue={query.get('search')!} maxLength={255} /><div className="form-field"><label htmlFor="rules-status">Situação</label><select id="rules-status" name="archived" defaultValue={query.get('archived')!}><option value="false">Ativas</option><option value="true">Arquivadas</option></select></div><button className="button secondary">Filtrar</button>
    </form>
    {result.loading && <Feedback message="Carregando regras…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>{!result.data.items.length && <div className="empty-state"><h2>Nenhuma regra encontrada.</h2><p>Cadastre uma regra ou altere os filtros.</p></div>}<div className="catalog-grid">{result.data.items.map((rule) => <Link className="catalog-card" to={`/precificacao/${rule.id}`} key={rule.id}><h2>{rule.name}</h2><p>Versão {rule.version} · {strategyName(rule.strategy_key)}</p><span className="record-status">{rule.archived_at ? 'Arquivada' : rule.is_default ? 'Padrão' : 'Ativa'}</span></Link>)}</div><Pagination page={result.data} onChange={(page) => { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next) }} /></>}
  </>
}

function RuleForm({ item, onSaved, onCancel }: { item?: Rule; onSaved: (rule: Rule) => void; onCancel: () => void }) {
  const { api } = useAuth()
  const initial = { name: item?.name || '', description: item?.description || '', strategy_key: item?.strategy_key || 'markup_percent', parameters: JSON.stringify(item?.parameters || { percentage: '30', rounding: 'none' }, null, 2), is_default: item?.is_default || false }
  const [draft, setDraft] = useState(initial)
  const [conflict, setConflict] = useState(false)
  const form = useFormAction()
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const parameters = JSON.parse(draft.parameters)
      const invalid = Object.keys(strategies[draft.strategy_key as keyof typeof strategies]?.fields || {}).filter(key => parameterError(key, parameters))
      if (invalid.length) throw new ApiError(422, invalid.map(key => ({ field: `parameters.${key}`, code: parameterError(key, parameters)! })))
      const body: Record<string, unknown> = item ? { ...changes(initial, draft), expected_version: item.version } : { ...draft }
      if ('parameters' in body) body.parameters = parameters
      if ('description' in body) body.description = draft.description.trim() || null
      if ('name' in body) body.name = draft.name.trim()
      try { onSaved(await api<Rule>(`/pricing-rules${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(body) })) }
      catch (error) { if (error instanceof ApiError && error.status === 409) setConflict(true); throw error }
    }, { conflict: 'A regra mudou ou foi arquivada em outra sessão. Seu texto foi preservado. Recarregue a versão atual antes de editar novamente.' })
  }
  return <><form className="detail-card" onSubmit={submit}><h2>{item ? 'Editar regra' : 'Configuração da regra'}</h2><UnsavedChanges dirty={!form.busy && (JSON.stringify(draft) !== JSON.stringify(initial))} /><FormFeedback state={form} /><fieldset disabled={form.busy || conflict}>
    <Field label="Nome da regra" required maxLength={180} value={draft.name} error={form.fields.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
    <TextArea label="Descrição" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
    <StrategyFields errors={form.fields} strategy={draft.strategy_key} parameters={JSON.parse(draft.parameters)} onChange={(strategy_key, parameters) => setDraft({ ...draft, strategy_key, parameters: JSON.stringify(parameters) })} />
    <RuleSimulator strategy={draft.strategy_key} parameters={JSON.parse(draft.parameters)} />
    <label className="check-label"><input type="checkbox" checked={draft.is_default} onChange={(event) => setDraft({ ...draft, is_default: event.target.checked })} />Regra padrão</label><p className="muted">Definir como padrão remove o padrão anterior. A escolha da regra em cada venda continua explícita.</p>
    </fieldset><div className="form-actions"><button className="button secondary" type="button" disabled={form.busy} onClick={() => { if (!item || JSON.stringify(draft) === JSON.stringify(initial) || window.confirm("Descartar alterações não salvas?")) onCancel() }}>Cancelar edição</button><button className="button primary" disabled={form.busy || conflict}>Salvar regra</button></div>
  </form>{conflict && item && <section className="detail-card"><p>Copie os dados que deseja manter antes de recarregar.</p><ConfirmButton label="Recarregar regra" title="Descartar a edição e recarregar?" description="O formulário será substituído pela versão atual do servidor." onConfirm={async () => onSaved(await api<Rule>(`/pricing-rules/${item.id}`))} /></section>}</>
}

export function NewRulePage() {
  const { identity } = useAuth()
  const navigate = useNavigate()
  if (identity?.user.role !== 'admin') return <h1>Acesso restrito</h1>
  return <><PageHeading section="PRECIFICAÇÃO" title="Nova regra" description="Salve a configuração para selecioná-la explicitamente nas vendas." /><RuleForm onSaved={(rule) => navigate(`/precificacao/${rule.id}`, { replace: true })} onCancel={() => navigate('/precificacao')} /></>
}

function RuleDetail({ initial }: { initial: Rule }) {
  const { identity } = useAuth()
  const [item, setItem] = useState(initial)
  const [editing, setEditing] = useState(false)
  function saved(rule: Rule) { setItem(rule); setEditing(false) }
  return <><PageHeading section="PRECIFICAÇÃO" title={item.name} description={`Versão ${item.version} · ${item.archived_at ? 'Arquivada' : item.is_default ? 'Padrão' : 'Ativa'}`}><Link className="button secondary" to="/precificacao">Voltar às regras</Link></PageHeading>
    {editing ? <RuleForm key={item.version} item={item} onSaved={saved} onCancel={() => setEditing(false)} /> : <section className="detail-card"><h2>Configuração</h2><p className="preserve-lines">{item.description || 'Sem descrição.'}</p><p>Estratégia: {strategyName(item.strategy_key)}</p><dl className="details">{Object.entries(strategies[item.strategy_key as keyof typeof strategies]?.fields || {}).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{String(item.parameters[key] ?? 'Indisponível')}</dd></div>)}</dl><RuleSimulator strategy={item.strategy_key} parameters={item.parameters} /><p className="info-note">Arquivar remove a definição de padrão; restaurar não a reaplica.</p>{identity?.user.role === 'admin' && <div className="form-actions">{!item.archived_at && <button className="button secondary" onClick={() => setEditing(true)}>Editar regra</button>}<ArchiveButton item={item} path={`/pricing-rules/${item.id}`} onSaved={saved} /></div>}</section>}
  </>
}

export function RuleDetailPage() {
  const { id } = useParams()
  const result = useResource<Rule>(`/pricing-rules/${encodeURIComponent(id || '')}`)
  return result.loading ? <Feedback message="Carregando regra…" /> : result.error ? <LoadError error={result.error} retry={result.reload} /> : result.data ? <RuleDetail key={result.data.id} initial={result.data} /> : null
}
