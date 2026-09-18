import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { changes, useFormAction, useResource } from '../../api/hooks'
import { Field, FormFeedback, PageHeading } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { catalog, type CatalogItem, type CatalogKind } from './types'
import { decimalInput, decimalText } from './decimals'
import { UnitSelect, useUnits } from './Units'
import { ArchiveButton, LoadError, TextArea } from './Shared'
import { PackagesPanel } from './Packages'
import { CompositionPanel } from './Composition'

type Draft = { name: string; sku: string; text: string; unit: string; quantity: string; cost: string }
function toDraft(item?: CatalogItem): Draft {
  return {
    name: item?.name || '', sku: item && 'sku' in item ? item.sku || '' : '',
    text: item ? 'notes' in item ? item.notes || '' : item.description || '' : '',
    unit: item && 'purchase_unit_code' in item ? item.purchase_unit_code : '',
    quantity: item && 'purchase_quantity' in item ? item.purchase_quantity : '1',
    cost: item ? 'purchase_cost' in item ? item.purchase_cost : 'base_price' in item ? item.base_price : '0' : '0',
  }
}
function payload(kind: CatalogKind, value: Draft): Record<string, string | null> {
  const common = { name: value.name.trim() }
  if (kind === 'materials') return { ...common, sku: value.sku.trim() || null, notes: value.text.trim() || null, purchase_unit_code: value.unit, purchase_quantity: decimalInput(value.quantity, 'quantity', 'purchase_quantity'), purchase_cost: decimalInput(value.cost, 'money', 'purchase_cost') }
  if (kind === 'services') return { ...common, description: value.text.trim() || null, base_price: decimalInput(value.cost, 'money', 'base_price') }
  return { ...common, sku: value.sku.trim() || null, description: value.text.trim() || null }
}

function CatalogForm({ kind, item, onSaved, onCancel }: { kind: CatalogKind; item?: CatalogItem; onSaved: (item: CatalogItem) => void; onCancel: () => void }) {
  const { api, identity } = useAuth()
  const units = useUnits()
  const [initial] = useState(() => toDraft(item))
  const [draft, setDraft] = useState(initial)
  const form = useFormAction()
  const config = catalog[kind]
  const unitReady = kind !== 'materials' || Boolean(units.data?.some((unit) => unit.code === draft.unit))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!unitReady) return
    await form.run(async () => {
      const next = payload(kind, draft)
      onSaved(await api<CatalogItem>(`/${kind}${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(item ? changes(payload(kind, initial), next) : next) }))
    }, { conflict: 'Não foi possível salvar. Confira se o SKU já existe (inclusive em arquivados) ou se o registro foi arquivado em outra sessão.' })
  }
  return <form className="detail-card" onSubmit={submit} aria-label={`${item ? 'Editar' : 'Cadastrar'} ${config.singular}`}><h2>{item ? 'Editar' : 'Cadastrar'} {config.singular}</h2><FormFeedback state={form} />
    <fieldset disabled={form.busy}><div className="form-grid"><Field label="Nome" required maxLength={180} value={draft.name} error={form.fields.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      {kind !== 'services' && <Field label="SKU" maxLength={60} hint="Opcional. Identificador único na empresa." value={draft.sku} error={form.fields.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} />}</div>
      {kind === 'materials' && <><div className="form-grid"><UnitSelect label="Unidade de compra" value={draft.unit} baseCode={item && 'purchase_unit_code' in item ? item.purchase_unit_code : undefined} error={form.fields.purchase_unit_code} onChange={(unit) => setDraft({ ...draft, unit })} />
        <Field label="Quantidade de compra" inputMode="decimal" required maxLength={32} hint="Maior que zero; até 6 casas decimais. Sem separador de milhar." value={draft.quantity} error={form.fields.purchase_quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></div>
        <p className="info-note">Ao trocar a unidade, ajuste a quantidade explicitamente. Não há conversão automática de quantidades ou custos.</p></>}
      {kind !== 'products' && <Field label={kind === 'materials' ? 'Custo da compra' : 'Preço base'} inputMode="decimal" required maxLength={32} hint={`${identity!.company.currency}. Zero ou maior, com até 2 casas decimais. Use vírgula ou ponto, sem separador de milhar.`} value={draft.cost} error={form.fields[kind === 'materials' ? 'purchase_cost' : 'base_price']} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} />}
      <TextArea label={kind === 'materials' ? 'Observações' : 'Descrição'} value={draft.text} error={form.fields[kind === 'materials' ? 'notes' : 'description']} onChange={(text) => setDraft({ ...draft, text })} />
    </fieldset>
    <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel} disabled={form.busy}>Cancelar</button><button className="button primary" disabled={form.busy || !unitReady}>{form.busy ? 'Salvando…' : `Salvar ${config.singular}`}</button></div>
  </form>
}

export function NewCatalogPage({ kind }: { kind: CatalogKind }) {
  const { identity } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const config = catalog[kind]
  if (identity?.user.role !== 'admin') return <section className="detail-card"><h1>Acesso restrito</h1><p>Somente administradores podem cadastrar itens do catálogo.</p></section>
  return <><PageHeading section="CATÁLOGO" title={`Novo ${config.singular}`} description={config.description} /><CatalogForm kind={kind} onCancel={() => navigate(`${config.route}${location.search}`)} onSaved={(item) => navigate(`${config.route}/${item.id}${location.search}`, { replace: true, state: { notice: 'Registro criado.' } })} /></>
}

function CatalogDetail({ initialItem, kind }: { initialItem: CatalogItem; kind: CatalogKind }) {
  const [item, setItem] = useState(initialItem)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const { identity } = useAuth()
  const location = useLocation()
  const config = catalog[kind]
  const admin = identity!.user.role === 'admin'
  const archived = Boolean(item.archived_at)
  return <><PageHeading section={config.title.toUpperCase()} title={item.name} description={archived ? 'Registro arquivado · histórico preservado' : 'Informações do catálogo'}><Link className="button secondary" to={`${config.route}${location.search}`}>Voltar ao catálogo</Link></PageHeading>
    {(message || location.state?.notice) && <p className="feedback success-message" role="status">{message || location.state.notice}</p>}
    {editing && admin && !archived ? <CatalogForm kind={kind} item={item} onCancel={() => setEditing(false)} onSaved={(updated) => { setItem(updated); setEditing(false); setMessage('Registro atualizado.') }} /> :
      <section className="detail-card"><div className="record-main"><h2>Dados do {config.singular}</h2><span className={`record-status ${archived ? '' : 'is-active'}`}>{archived ? 'Arquivado' : 'Ativo'}</span></div>
        <dl className="details">{'sku' in item && <div><dt>SKU</dt><dd>{item.sku || 'Não informado'}</dd></div>}
          {'purchase_cost' in item && <><div><dt>Compra</dt><dd>{decimalText(item.purchase_quantity)} {item.purchase_unit_code}</dd></div><div><dt>Custo da compra</dt><dd>{identity!.company.currency} {decimalText(item.purchase_cost)}</dd></div></>}
          {'base_price' in item && <div><dt>Preço base</dt><dd>{identity!.company.currency} {decimalText(item.base_price)}</dd></div>}
          <div className="wide-detail"><dt>{'notes' in item ? 'Observações' : 'Descrição'}</dt><dd className="preserve-lines">{('notes' in item ? item.notes : item.description) || 'Não informado'}</dd></div>
        </dl>
        {admin && <div className="form-actions">{!archived && <button className="button secondary" onClick={() => { setEditing(true); setMessage('') }}><Pencil size={16} />Editar {config.singular}</button>}<ArchiveButton item={item} path={`/${kind}/${item.id}`} onSaved={(updated) => { setItem(updated); setMessage(updated.archived_at ? 'Registro arquivado.' : 'Registro restaurado.') }} /></div>}
      </section>}
    {'purchase_unit_code' in item && <PackagesPanel material={item} />}
    {'materials' in item && <CompositionPanel product={item} />}
  </>
}

export function CatalogDetailPage({ kind }: { kind: CatalogKind }) {
  const { id } = useParams()
  const location = useLocation()
  const result = useResource<CatalogItem>(`/${kind}/${encodeURIComponent(id || '')}`)
  if (result.loading) return <Feedback message="Carregando registro…" />
  if (result.error) return <><Link className="button secondary" to={`${catalog[kind].route}${location.search}`}>Voltar ao catálogo</Link><LoadError error={result.error} retry={result.reload} /></>
  return result.data ? <CatalogDetail kind={kind} initialItem={result.data} key={`${kind}:${result.data.id}`} /> : null
}
