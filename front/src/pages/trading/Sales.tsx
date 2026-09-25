import { QuantityField } from '../../components/ValueFields'
import { PeriodShortcuts } from '../../components/PeriodShortcuts'
import { UnsavedChanges } from '../../components/UnsavedChanges'
import { MoneyField } from '../../components/ValueFields'
import { timezoneLabel, localDateTime, zonedInstant, dateBoundary, filterDate } from '../../components/dates'
import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { changes, useFormAction, useResource, type Page } from '../../api/hooks'
import { useAuth } from '../../auth/AuthProvider'
import { Field, FormFeedback, PageHeading, SelectField } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { ConfirmButton } from '../../components/ConfirmButton'
import { LoadError } from '../catalog/Shared'
import { UnitSelect } from '../catalog/Units'
import { decimalInput, decimalText, moneyText } from '../catalog/decimals'
import type { CatalogItem } from '../catalog/types'
import { Picker } from './Picker'
import { usePreview, strategyName, type Calculation } from './PricingCalculator'
import { dateText, lineInput, sameLines } from './validation'
import { saleStatus, type LineInput, type Rule, type Sale } from './types'

function money(value: string | null, currency: string) { return value === null ? 'Indisponível' : moneyText(value, currency) }

function CalculationHistory({ sale }: { sale: Sale }) {
  const snapshot = sale.pricing_snapshot as { rule?: { name: string; strategy_key: string }; calculation?: { lines: { line_id: string; pricing: Partial<Calculation>; cost: { components?: { name: string; quantity: string; unit_code: string; cost: string }[] } }[] } } | null
  return <>{snapshot?.rule && <p>{snapshot.rule.name} · {strategyName(snapshot.rule.strategy_key)}</p>}{snapshot?.calculation?.lines.map((row, index) => <article className="sale-line" key={row.line_id}><h3>Cálculo do item {index + 1}</h3><p>{row.pricing.reason}</p><dl className="details"><div><dt>Preço antes do arredondamento</dt><dd>{money(row.pricing.price_before_adjustment ?? null, sale.currency)}</dd></div><div><dt>Preço sugerido unitário</dt><dd>{money(row.pricing.suggested_price ?? null, sale.currency)}</dd></div></dl>{row.cost.components?.map((component, position) => <p key={position}>{component.name}: {decimalText(component.quantity)} {component.unit_code} · {money(component.cost, sale.currency)}</p>)}</article>)}</>
}

export function SalesPage() {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const filter = useFormAction()
  const query = new URLSearchParams({ page: params.get('page') || '1', page_size: '10' })
  for (const field of ['status', 'start', 'end']) if (params.get(field)) query.set(field, params.get(field)!)
  const result = useResource<Page<Sale>>(`/sales?${query}`)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await filter.run(async () => {
      const next = new URLSearchParams()
      if (data.get('status')) next.set('status', String(data.get('status')))
      for (const field of ['start', 'end']) if (data.get(field)) next.set(field, dateBoundary(String(data.get(field)), identity!.company.timezone, field === 'end'))
      if (next.has('start') && next.has('end') && Date.parse(next.get('start')!) >= Date.parse(next.get('end')!)) throw new ApiError(422, [{ field: 'end', code: 'invalid_period' }])
      setParams(next)
    })
  }
  return <><PageHeading section="VENDAS" title="Vendas" description={`Valores cobrados e histórico. Horário da empresa: ${timezoneLabel(identity!.company.timezone)}.`}><Link className="button primary" to="/vendas/nova">Nova venda</Link></PageHeading>
    <form className="detail-card" onSubmit={submit} key={params.toString()}><FormFeedback state={filter} /><div className="form-grid"><div className="form-field"><label htmlFor="sales-status">Status</label><select id="sales-status" name="status" defaultValue={params.get('status') || ''}><option value="">Todos</option>{Object.entries(saleStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <Field label="De" type="date" name="start" defaultValue={filterDate(params.get("start"), identity!.company.timezone)} error={filter.fields.start} /><Field label="Até" type="date" name="end" defaultValue={filterDate(params.get("end"), identity!.company.timezone, true)} error={filter.fields.end ? 'Informe uma data válida posterior ao início.' : undefined} /></div><div className="form-actions"><PeriodShortcuts timezone={identity!.company.timezone} /><button className="button secondary" type="button" onClick={() => setParams({})}>Limpar filtros</button><button className="button primary">Filtrar vendas</button></div></form>
    {result.loading && <Feedback message="Carregando vendas…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>{!result.data.items.length && <div className="empty-state"><h2>Nenhuma venda encontrada.</h2><p>Crie um rascunho ou ajuste os filtros.</p></div>}<div className="catalog-grid">{result.data.items.map((sale) => <Link className="catalog-card" to={`/vendas/${sale.id}`} key={sale.id}><h2>{sale.description}</h2><p>{dateText(sale.occurred_at, identity!.company.timezone)}</p><p className="catalog-value">{money(sale.final_total, sale.currency)}</p><span className="record-status">{saleStatus[sale.status]}</span></Link>)}</div><Pagination page={result.data} onChange={(page) => { const next = new URLSearchParams(params); next.set('page', String(page)); setParams(next) }} /></>}
  </>
}

type DraftLine = { key: string; name: string; baseUnit?: string; value: LineInput }
function SaleForm({ item, onSaved, onCancel }: { item?: Sale; onSaved: (sale: Sale) => void; onCancel: () => void }) {
  const { api, identity } = useAuth()
  const [initial] = useState(() => ({ description: item?.description || '', occurred_at: localDateTime(item?.occurred_at || new Date().toISOString(), identity!.company.timezone), final_total: item?.final_total || '0', pricing_rule_id: item?.pricing_rule_id || null }))
  const [draft, setDraft] = useState(initial)
  const [lines, setLines] = useState<DraftLine[]>(() => item?.lines.map((line) => ({ key: line.id, name: line.description_snapshot, baseUnit: line.unit_code || undefined, value: lineInput(line) })) || [])
  const [kind, setKind] = useState<LineInput['kind']>('service')
  const [adding, setAdding] = useState(false)
  const [choosingRule, setChoosingRule] = useState(false)
  const loadDefault = useCallback(async (path: string, signal: AbortSignal) => {
    let page = 1
    while (true) {
      const result = await api<Page<Rule>>(`${path}&page=${page}`, { signal })
      const rule = result.items.find(item => item.is_default)
      if (rule || !result.has_next) return { ...result, items: rule ? [rule] : [] }
      page += 1
    }
  }, [api])
  const defaultRules = useResource<Page<Rule>>("/pricing-rules?page_size=100&archived=false", loadDefault)
  const defaultRule = defaultRules.data?.items.find(rule => rule.is_default)
  const [applied, setApplied] = useState(false)
  const [ruleName, setRuleName] = useState(item?.pricing_rule_id ? `Regra histórica · versão ${item.rule_version}` : 'Sem regra')
  const form = useFormAction()
  const originalLines = (item?.lines || []).map(lineInput)
  const linesChanged = !sameLines(originalLines, lines.map((line) => line.value))
  const preview = usePreview<{ cost_total: string | null; suggested_total: string | null; lines: { pricing: { reason?: string; suggested_price?: string | null } }[] }>('/sales/preview', JSON.stringify({ pricing_rule_id: draft.pricing_rule_id, ...(item ? { sale_id: item.id } : {}), ...(!item || linesChanged ? { lines: lines.map(line => ({ ...line.value, quantity: line.value.quantity.replace(',', '.') })) } : {}) }))
  function add(record: CatalogItem) {
    const unit = 'purchase_unit_code' in record ? record.purchase_unit_code : undefined
    setLines([...lines, { key: crypto.randomUUID(), name: record.name, baseUnit: unit, value: { kind, [`${kind}_id`]: record.id, quantity: '1', ...(unit ? { unit_code: unit } : {}) } }])
    setAdding(false)
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.sale-line:last-of-type input')?.focus())
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const next = { ...draft, description: draft.description.trim(), occurred_at: item && draft.occurred_at === initial.occurred_at ? item.occurred_at : zonedInstant(draft.occurred_at, identity!.company.timezone), final_total: decimalInput(draft.final_total, 'money', 'final_total') }
      const body: Record<string, unknown> = item ? changes({ ...initial, occurred_at: item.occurred_at }, next) : next
      if (!item || linesChanged) body.lines = lines.map((line, index) => ({ ...line.value, quantity: decimalInput(line.value.quantity, 'quantity', `lines.${index}.quantity`) }))
      onSaved(await api<Sale>(`/sales${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(body) }))
    }, { conflict: 'A venda pode ter sido concluída/cancelada ou alguma referência foi arquivada. Sua edição foi preservada; confira o estado atual em outra aba antes de tentar novamente.' })
  }
  return <form className="detail-card" onSubmit={submit}><h2>{item ? 'Editar rascunho' : 'Dados do rascunho'}</h2><UnsavedChanges dirty={!form.busy && (JSON.stringify(draft) !== JSON.stringify(initial) || linesChanged)} /><FormFeedback state={form} /><fieldset disabled={form.busy}>
    <Field label="Descrição da venda" required value={draft.description} error={form.fields.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
    <Field label="Data da venda" type="datetime-local" required value={draft.occurred_at} hint={`Horário da empresa: ${timezoneLabel(identity!.company.timezone)}`} error={form.fields.occurred_at} onChange={(event) => setDraft({ ...draft, occurred_at: event.target.value })} />
    <MoneyField currency={item?.currency || identity!.company.currency} label="Valor cobrado" required inputMode="decimal" maxLength={32} value={draft.final_total} hint="Você pode alterar o preço sugerido." error={form.fields.final_total} onChange={final_total => setDraft({ ...draft, final_total })} />
    <div className="form-actions"><button type="button" className="button secondary" disabled={preview.stale || preview.data?.suggested_total == null} onClick={() => { setDraft({ ...draft, final_total: preview.data!.suggested_total! }); setApplied(true) }}>Usar total sugerido</button></div>
    {applied && <p role="status">Total sugerido aplicado ao valor cobrado.</p>}
    {!preview.stale && preview.data?.suggested_total != null && draft.final_total && decimalText(draft.final_total) !== decimalText(preview.data.suggested_total) && <p className="muted">Valor cobrado diferente da sugestão.</p>}
    <section className="trading-section"><h3>Regra de precificação</h3><p>{ruleName}</p>{defaultRule && draft.pricing_rule_id !== defaultRule.id && <button type="button" className="button secondary" onClick={() => { setDraft({ ...draft, pricing_rule_id: defaultRule.id }); setRuleName(defaultRule.name) }}>Usar regra padrão</button>}<p className="muted">A regra padrão não é aplicada automaticamente. A sugestão usa a regra selecionada. O total final permanece livre para edição.</p><div className="form-actions"><button className="button secondary" type="button" onClick={() => setChoosingRule(!choosingRule)}>{choosingRule ? 'Fechar seleção de regra' : 'Escolher regra'}</button>{draft.pricing_rule_id && <button className="button secondary" type="button" onClick={() => { setDraft({ ...draft, pricing_rule_id: null }); setRuleName('Sem regra') }}>Remover regra</button>}</div>
      {choosingRule && <Picker<Rule> path="/pricing-rules" label="regras" onSelect={(rule) => { setDraft({ ...draft, pricing_rule_id: rule.id }); setRuleName(item?.pricing_rule_id === rule.id ? `Regra histórica · versão ${item.rule_version}` : `${rule.name} · versão ${rule.version}`); setChoosingRule(false) }} />}
    </section>
    <section className="trading-section"><h3>Itens da venda</h3>{!lines.length && <p>O rascunho pode ser salvo sem itens. Para concluir, adicione pelo menos um.</p>}
      {lines.map((line, index) => <section className="sale-line" key={line.key} aria-label={`Item ${index + 1}: ${line.name}`}><h4>{line.name}</h4><div className="form-grid"><QuantityField label={`Quantidade do item ${index + 1}`} required inputMode="decimal" maxLength={32} value={line.value.quantity} error={form.fields[`lines.${index}.quantity`]} onChange={(event) => setLines(lines.map((row) => row.key === line.key ? { ...row, value: { ...row.value, quantity: event.target.value } } : row))} />
        {line.value.kind === 'material' && <UnitSelect label={`Unidade do item ${index + 1}`} value={line.value.unit_code || ''} baseCode={line.baseUnit} onChange={(unit_code) => setLines(lines.map((row) => row.key === line.key ? { ...row, value: { ...row.value, unit_code } } : row))} />}</div><button className="button secondary" type="button" onClick={() => setLines(lines.filter((row) => row.key !== line.key))}>Remover item {index + 1}</button></section>)}
      <button className="button secondary" type="button" onClick={() => setAdding(!adding)}>{adding ? 'Fechar seleção de item' : 'Adicionar item'}</button>
      {adding && <><SelectField label="Tipo de item" value={kind} onChange={(value) => setKind(value as LineInput['kind'])}><option value="service">Serviço</option><option value="product">Produto</option><option value="material">Material</option></SelectField><Picker<CatalogItem> key={kind} path={`/${kind}s`} label="itens ativos" onSelect={add} /></>}
      {item && linesChanged && <p className="info-note">Salvar substituirá todos os itens e capturará novamente os nomes e preços do catálogo. Referências arquivadas precisam ser removidas ou restauradas. O total manual não muda automaticamente.</p>}
      <p className="muted">Quantidades aceitam até 6 casas decimais. Unidades compatíveis são convertidas para calcular o custo. Custos ausentes permanecem indisponíveis.</p>
    </section>
    <section className="trading-section preview-result"><h3>Sugestão para esta venda</h3><p role="status">{preview.stale ? "Atualizando… Resultado anterior." : "Sugestão atualizada."}</p>{preview.error ? <p role="alert">{preview.error}</p> : !preview.data ? <p>Calculando…</p> : <><p>Custo total: {money(preview.data.cost_total, item?.currency || identity!.company.currency)}</p><p>Total sugerido: {money(preview.data.suggested_total, item?.currency || identity!.company.currency)}</p>{preview.data.lines.map((row, index) => <p key={index}>Item {index + 1}: {money(row.pricing.suggested_price ?? null, item?.currency || identity!.company.currency)} {row.pricing.reason}</p>)}</>}</section>
    {item && <p className="info-note">Evite editar este rascunho em várias sessões: a última edição recebida prevalece nos campos enviados.</p>}
    </fieldset><div className="form-actions"><button className="button secondary" type="button" disabled={form.busy} onClick={() => { if (!item || (JSON.stringify(draft) === JSON.stringify(initial) && !linesChanged) || window.confirm("Descartar alterações não salvas?")) onCancel() }}>Cancelar edição</button><button className="button primary" disabled={form.busy}>{form.busy ? 'Salvando…' : 'Salvar rascunho'}</button></div>
  </form>
}

export function NewSalePage() {
  const navigate = useNavigate()
  return <><PageHeading section="VENDAS" title="Nova venda" description="Comece com um rascunho e informe o total manualmente." /><SaleForm onSaved={(sale) => navigate(`/vendas/${sale.id}`, { replace: true })} onCancel={() => navigate('/vendas')} /></>
}

function SaleDetail({ initial }: { initial: Sale }) {
  const { identity, api } = useAuth()
  const [item, setItem] = useState(initial)
  const [editing, setEditing] = useState(false)
  function saved(sale: Sale) { setItem(sale); setEditing(false) }
  return <><PageHeading section="VENDAS" title={item.description} description={`${saleStatus[item.status]} · ${dateText(item.occurred_at, identity!.company.timezone)} (${timezoneLabel(identity!.company.timezone)})`}><Link className="button secondary" to="/vendas">Voltar às vendas</Link></PageHeading>
    {editing ? <SaleForm item={item} onSaved={saved} onCancel={() => setEditing(false)} /> : <>
      <section className="detail-card"><h2>Resumo da venda</h2><dl className="details"><div><dt>Valor cobrado</dt><dd className="metric-value">{money(item.final_total, item.currency)}</dd></div><div><dt>Total sugerido</dt><dd>{money(item.suggested_total, item.currency)}</dd></div><div><dt>Custo total</dt><dd>{money(item.cost_total, item.currency)}</dd></div></dl><p className="info-note">Valores na moeda registrada na venda ({item.currency}). Custos e sugestões indisponíveis não representam zero.</p>
        {item.status === "draft" && !item.lines.length && <p>Adicione pelo menos um item para concluir a venda.</p>}<div className="form-actions">{item.status === 'draft' && <><button className="button secondary" onClick={() => setEditing(true)}>Editar rascunho</button><ConfirmButton intent="positive" label="Concluir venda" title={`Concluir esta venda com valor cobrado de ${money(item.final_total, item.currency)}?`} description={`O total manual de ${money(item.final_total, item.currency)} será mantido. A venda não poderá mais ser editada.`} disabled={!item.lines.length} onConfirm={async () => saved(await api<Sale>(`/sales/${item.id}/complete`, { method: 'POST' }))} /></>}{identity!.user.role === 'admin' && item.status !== 'cancelled' && <ConfirmButton label="Cancelar venda" title="Cancelar esta venda?" description="O histórico será preservado. Esta ação não pode ser desfeita e a venda não poderá ser reaberta." onConfirm={async () => saved(await api<Sale>(`/sales/${item.id}/cancel`, { method: 'POST' }))} />}</div>
      </section>
      <section className="detail-card"><h2>Itens registrados</h2>{!item.lines.length && <p>Nenhum item registrado.</p>}{item.lines.map((line) => <article className="sale-line" key={line.id}><h3>{line.description_snapshot}</h3><p>{decimalText(line.quantity)} {line.unit_code || 'un'}</p><dl className="details"><div><dt>Preço sugerido por unidade</dt><dd>{money(line.unit_price_snapshot, item.currency)}</dd></div><div><dt>Custo unitário registrado</dt><dd>{money(line.unit_cost_snapshot, item.currency)}</dd></div><div><dt>Subtotal sugerido</dt><dd>{money(line.line_total, item.currency)}</dd></div></dl></article>)}</section>
      <details className="detail-card"><summary>Entenda este cálculo</summary><p>Autor (ID): {item.created_by_id}</p>{item.pricing_snapshot ? <><p>Versão histórica: {item.rule_version ?? 'Sem regra'}. Configuração preservada na operação.</p><CalculationHistory sale={item} /><details><summary>Valores exatos registrados</summary><pre className="json-view">{JSON.stringify(item.pricing_snapshot, null, 2)}</pre></details></> : <p>Nenhuma regra selecionada.</p>}</details>
    </>}
  </>
}

export function SaleDetailPage() {
  const { id } = useParams()
  const result = useResource<Sale>(`/sales/${encodeURIComponent(id || '')}`)
  return result.loading ? <Feedback message="Carregando venda…" /> : result.error ? <LoadError error={result.error} retry={result.reload} /> : result.data ? <SaleDetail key={result.data.id} initial={result.data} /> : null
}
