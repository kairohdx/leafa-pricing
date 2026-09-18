import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { changes, useFormAction, useResource, type Page } from '../../api/hooks'
import { Field, FormFeedback, PageHeading, SelectField } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import type { Material, MaterialPackage } from './types'
import { ArchiveButton, LoadError } from './Shared'
import { decimalInput, decimalText } from './decimals'
import { UnitSelect, useUnits } from './Units'

export function PackagesPanel({ material }: { material: Material }) {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const archived = params.get('embalagensArquivadas') === 'true'
  const rawPage = Number(params.get('embalagensPagina') || '1')
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 2_147_483_647 ? rawPage : 1
  const result = useResource<Page<MaterialPackage>>(`/materials/${material.id}/packages?page=${page}&page_size=10&archived=${archived}`)
  const suffix = params.size ? `?${params}` : ''
  return <section className="catalog-section"><div className="section-heading"><h2>Embalagens</h2>{identity!.user.role === 'admin' && !material.archived_at && <Link className="button secondary" to={`/materiais/${material.id}/embalagens/nova${suffix}`}><Plus size={17} />Nova embalagem</Link>}</div>
    {material.archived_at && <p className="info-note">Restaure o material para criar, editar ou restaurar embalagens. O arquivamento do material não altera o estado das embalagens.</p>}
    <div className="compact-filter"><SelectField label="Situação das embalagens" value={String(archived)} onChange={(value) => { const next = new URLSearchParams(params); next.set('embalagensArquivadas', value); next.delete('embalagensPagina'); setParams(next) }}><option value="false">Ativas</option><option value="true">Arquivadas</option></SelectField></div>
    {result.loading && <Feedback message="Carregando embalagens…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>{!result.data.items.length ? <p className="empty-state">Nenhuma embalagem {archived ? 'arquivada' : 'ativa'} nesta página.</p> : <div className="catalog-grid">{result.data.items.map((item) => <Link className="catalog-card" key={item.id} to={`/materiais/${material.id}/embalagens/${item.id}${suffix}`}><h3>{item.name}</h3><p>{decimalText(item.quantity)} {item.unit_code}</p><span className={`record-status ${item.archived_at ? '' : 'is-active'}`}>{item.archived_at ? 'Arquivada' : 'Ativa'}</span></Link>)}</div>}<Pagination page={result.data} onChange={(nextPage) => { const next = new URLSearchParams(params); next.set('embalagensPagina', String(nextPage)); setParams(next) }} /></>}
  </section>
}

function PackageForm({ item, material, back }: { item?: MaterialPackage; material: Material; back: string }) {
  const { api } = useAuth()
  const navigate = useNavigate()
  const units = useUnits()
  const [initial] = useState({ name: item?.name || '', quantity: item?.quantity || '1', unit_code: item?.unit_code || material.purchase_unit_code })
  const [draft, setDraft] = useState(initial)
  const form = useFormAction()
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const payload = { ...draft, name: draft.name.trim(), quantity: decimalInput(draft.quantity, 'quantity', 'quantity') }
      await api(item ? `/material-packages/${item.id}` : '/material-packages', { method: item ? 'PATCH' : 'POST', body: JSON.stringify(item ? changes(initial, payload) : { ...payload, material_id: material.id }) })
      navigate(back, { replace: true, state: { notice: item ? 'Embalagem atualizada.' : 'Embalagem criada.' } })
    }, { conflict: 'Não foi possível salvar. O nome da embalagem pode estar em uso (inclusive em arquivadas), ou o material/embalagem foi arquivado.' })
  }
  return <form className="detail-card" onSubmit={submit} aria-label="Dados da embalagem"><FormFeedback state={form} /><fieldset disabled={form.busy}>
    <Field label="Nome da embalagem" required maxLength={180} value={draft.name} error={form.fields.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
    <div className="form-grid"><Field label="Quantidade" required inputMode="decimal" maxLength={32} hint="Maior que zero, até 6 casas decimais. Sem separador de milhar." value={draft.quantity} error={form.fields.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /><UnitSelect value={draft.unit_code} baseCode={material.purchase_unit_code} onChange={(unit_code) => setDraft({ ...draft, unit_code })} error={form.fields.unit_code} /></div>
  </fieldset><p className="info-note">A unidade deve ter a mesma dimensão da compra do material. Não há conversão automática.</p><div className="form-actions"><Link className="button secondary" to={back}>Voltar ao material</Link><button className="button primary" disabled={form.busy || !units.data?.some((unit) => unit.code === draft.unit_code)}>{form.busy ? 'Salvando…' : 'Salvar embalagem'}</button></div></form>
}

function PackageContent({ initial, material, back }: { initial: MaterialPackage; material: Material; back: string }) {
  const { identity } = useAuth()
  const [item, setItem] = useState(initial)
  const [editing, setEditing] = useState(false)
  const admin = identity!.user.role === 'admin'
  return <><PageHeading section="EMBALAGENS" title={item.name} description={`Material: ${material.name}`}><Link className="button secondary" to={back}>Voltar ao material</Link></PageHeading>
    {editing && admin && !item.archived_at && !material.archived_at ? <PackageForm item={item} material={material} back={back} /> : <section className="detail-card"><dl className="details"><div><dt>Quantidade</dt><dd>{decimalText(item.quantity)} {item.unit_code}</dd></div><div><dt>Situação</dt><dd>{item.archived_at ? 'Arquivada' : 'Ativa'}</dd></div></dl>
      {material.archived_at && <p className="info-note">O material está arquivado. Restaure-o antes de editar ou restaurar a embalagem.</p>}
      {admin && <div className="form-actions">{!item.archived_at && !material.archived_at && <button className="button secondary" onClick={() => setEditing(true)}>Editar embalagem</button>}<ArchiveButton item={item} path={`/material-packages/${item.id}`} disabled={Boolean(item.archived_at && material.archived_at)} onSaved={setItem} /></div>}
    </section>}
  </>
}

function ExistingPackage({ material, packageId, back }: { material: Material; packageId: string; back: string }) {
  const result = useResource<MaterialPackage>(`/material-packages/${encodeURIComponent(packageId)}`)
  if (result.loading) return <Feedback message="Carregando embalagem…" />
  if (result.error) return <LoadError error={result.error} retry={result.reload} />
  if (!result.data || result.data.material_id !== material.id) return <Feedback message="Não encontramos esta embalagem neste material." error />
  return <PackageContent initial={result.data} material={material} back={back} key={result.data.id} />
}

export function PackagePage() {
  const { id, packageId } = useParams()
  const { identity } = useAuth()
  const location = useLocation()
  const result = useResource<Material>(`/materials/${encodeURIComponent(id || '')}`)
  const back = `/materiais/${id}${location.search}`
  if (result.loading) return <Feedback message="Carregando material…" />
  if (result.error) return <LoadError error={result.error} retry={result.reload} />
  if (!result.data) return null
  if (packageId) return <ExistingPackage material={result.data} packageId={packageId} back={back} />
  if (identity!.user.role !== 'admin' || result.data.archived_at) return <section className="detail-card"><h1>Cadastro indisponível</h1><p>É necessário ser administrador e ter um material ativo.</p><Link className="button secondary" to={back}>Voltar ao material</Link></section>
  return <><PageHeading section="EMBALAGENS" title="Nova embalagem" description={`Material: ${result.data.name}`} /><PackageForm material={result.data} back={back} /></>
}
