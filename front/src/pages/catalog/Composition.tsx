import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { changes, useFormAction, useResource, type Page } from '../../api/hooks'
import { Field, FormFeedback } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { ConfirmButton } from '../../components/ConfirmButton'
import { LoadError } from './Shared'
import { UnitSelect, useUnits } from './Units'
import { decimalInput, decimalText } from './decimals'
import type { Component, Material, Product } from './types'

function MaterialPicker({ selected, exclude, onSelect }: { selected: Material | null; exclude: string[]; onSelect: (material: Material) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState({ search: '', page: 1 })
  const query = new URLSearchParams({ search: filter.search, page: String(filter.page), page_size: '10', archived: 'false' })
  const result = useResource<Page<Material>>(`/materials?${query}`)
  return <div className="material-picker">
    <div className="filter-bar"><Field label="Buscar material para composição" value={search} maxLength={255} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setFilter({ search: search.trim(), page: 1 }) } }} /><button className="button secondary" type="button" onClick={() => setFilter({ search: search.trim(), page: 1 })}>Buscar materiais</button></div>
    {result.loading && <Feedback message="Carregando materiais…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <><div className="material-options">{result.data.items.map((material) => <button className="material-option" type="button" key={material.id} disabled={exclude.includes(material.id)} aria-pressed={selected?.id === material.id} onClick={() => onSelect(material)}>
      <strong>{material.name}</strong><span>{material.sku || 'Sem SKU'} · {material.purchase_unit_code}{exclude.includes(material.id) ? ' · Já incluído' : ''}</span>
    </button>)}</div>{!result.data.items.length && <p className="empty-state">Nenhum material ativo encontrado.</p>}<Pagination page={result.data} onChange={(page) => setFilter({ ...filter, page })} /></>}
  </div>
}

function ComponentForm({ productId, material, component, onSaved, onCancel }: { productId: string; material: Material; component?: Component; onSaved: (component: Component) => void; onCancel: () => void }) {
  const { api } = useAuth()
  const units = useUnits()
  const [initial] = useState({ quantity: component?.quantity || '1', unit_code: component?.unit_code || material.purchase_unit_code })
  const [draft, setDraft] = useState(initial)
  const form = useFormAction()
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const next = { ...draft, quantity: decimalInput(draft.quantity, 'quantity', 'quantity') }
      const path = `/products/${productId}/materials${component ? `/${component.id}` : ''}`
      onSaved(await api<Component>(path, { method: component ? 'PATCH' : 'POST', body: JSON.stringify(component ? changes(initial, next) : { ...next, material_id: material.id }) }))
    }, { conflict: 'O material pode já estar na composição, ou o produto/material foi arquivado. Confira o catálogo antes de repetir.' })
  }
  return <form className="component-form" onSubmit={submit} aria-label="Componente do produto"><h3>{material.name}</h3><FormFeedback state={form} /><fieldset disabled={form.busy}>
    <div className="form-grid"><Field label="Quantidade na composição" required inputMode="decimal" maxLength={32} value={draft.quantity} error={form.fields.quantity} hint="Maior que zero, até 6 casas decimais. Sem separador de milhar." onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /><UnitSelect value={draft.unit_code} baseCode={material.purchase_unit_code} error={form.fields.unit_code} onChange={(unit_code) => setDraft({ ...draft, unit_code })} /></div>
  </fieldset><p className="info-note">Informe a quantidade na unidade selecionada. Não há conversão ou cálculo automático de custos.</p><div className="form-actions"><button className="button secondary" type="button" disabled={form.busy} onClick={onCancel}>Cancelar</button><button className="button primary" disabled={form.busy || !units.data?.some((unit) => unit.code === draft.unit_code)}>{form.busy ? 'Salvando…' : component ? 'Salvar componente' : 'Adicionar à composição'}</button></div></form>
}

function ComponentCard({ component, product, onSaved, onRemoved }: { component: Component; product: Product; onSaved: (component: Component) => void; onRemoved: (id: string) => void }) {
  const { api, identity } = useAuth()
  const material = useResource<Material>(`/materials/${component.material_id}`)
  const [editing, setEditing] = useState(false)
  const writable = identity!.user.role === 'admin' && !product.archived_at
  return <article className="record-card">
    {material.loading && <Feedback message="Carregando material do componente…" />}
    {material.error && <LoadError error={material.error} retry={material.reload} />}
    {material.data && <><div className="record-main"><h3><Link to={`/materiais/${material.data.id}`}>{material.data.name}</Link></h3><span className={`record-status ${material.data.archived_at ? '' : 'is-active'}`}>{material.data.archived_at ? 'Material arquivado' : 'Material ativo'}</span></div><p className="component-amount">{decimalText(component.quantity)} {component.unit_code}</p></>}
    {editing && writable && material.data && !material.data.archived_at ? <ComponentForm component={component} material={material.data} productId={product.id} onCancel={() => setEditing(false)} onSaved={(updated) => { onSaved(updated); setEditing(false) }} /> :
      writable && <div className="form-actions">{material.data && !material.data.archived_at && <button className="button secondary" onClick={() => setEditing(true)}>Editar componente</button>}<ConfirmButton label="Remover componente" title="Remover este material da composição?" description="A composição atual será alterada. Vendas e seus valores históricos serão preservados." onConfirm={async () => { await api(`/products/${product.id}/materials/${component.id}`, { method: 'DELETE' }); onRemoved(component.id) }} /></div>}
    {material.data?.archived_at && <p className="detail-note">Restaure o material para editar sua quantidade ou unidade. Ele ainda pode ser removido de um produto ativo.</p>}
  </article>
}

export function CompositionPanel({ product }: { product: Product }) {
  const { identity } = useAuth()
  const [components, setComponents] = useState(product.materials)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Material | null>(null)
  const [message, setMessage] = useState('')
  const writable = identity!.user.role === 'admin' && !product.archived_at
  return <section className="catalog-section"><div className="section-heading"><h2>Composição do produto</h2>{writable && !adding && <button className="button secondary" onClick={() => { setAdding(true); setSelected(null); setMessage('') }}><Plus size={17} />Adicionar material</button>}</div>
    <p className="info-note">Custos calculados indisponíveis. A composição registra materiais, quantidades e unidades; não calcula preço ou custo do produto.</p>
    {product.archived_at && <p className="info-note">Restaure o produto para alterar sua composição.</p>}
    {message && <p className="feedback success-message" role="status">{message}</p>}
    {writable && adding && <section className="detail-card composition-add"><h3>Escolha um material ativo</h3><MaterialPicker selected={selected} exclude={components.map((component) => component.material_id)} onSelect={setSelected} />
      {selected ? <ComponentForm key={selected.id} productId={product.id} material={selected} onCancel={() => setAdding(false)} onSaved={(component) => { setComponents((previous) => [...previous, component]); setAdding(false); setMessage('Material adicionado à composição.') }} /> : <div className="form-actions"><button className="button secondary" onClick={() => setAdding(false)}>Cancelar inclusão</button></div>}
    </section>}
    <div className="record-list">{components.map((component) => <ComponentCard key={component.id} component={component} product={product} onSaved={(updated) => { setComponents((previous) => previous.map((item) => item.id === updated.id ? updated : item)); setMessage('Componente atualizado.') }} onRemoved={(id) => { setComponents((previous) => previous.filter((item) => item.id !== id)); setMessage('Componente removido.') }} />)}</div>
    {!components.length && <p className="empty-state">Este produto ainda não possui materiais na composição.</p>}
  </section>
}
