import { useId, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useResource, type Page } from '../../api/hooks'
import { Field, PageHeading } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { ConfirmButton } from '../../components/ConfirmButton'
import { catalog, type CatalogItem, type CatalogKind } from './types'
import { decimalText } from './decimals'

export function TextArea({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const id = useId()
  return <div className="form-field"><label htmlFor={id}>{label}</label><textarea id={id} value={value} rows={4} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{error && <small id={`${id}-error`} className="field-error">{error}</small>}</div>
}

export function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return <div><Feedback message={error} error /><button className="button secondary" onClick={retry}>Tentar novamente</button></div>
}

export function ArchiveButton<T extends { name: string; archived_at: string | null }>({ item, path, onSaved, disabled = false }: { item: T; path: string; onSaved: (item: T) => void; disabled?: boolean }) {
  const { api } = useAuth()
  const archived = Boolean(item.archived_at)
  return <ConfirmButton label={archived ? 'Restaurar' : 'Arquivar'} title={`${archived ? 'Restaurar' : 'Arquivar'} ${item.name}?`} disabled={disabled}
    description={archived ? 'O registro voltará ao catálogo ativo. Seu histórico será preservado.' : 'O registro sairá do catálogo ativo. Seu histórico e as vendas existentes serão preservados.'}
    onConfirm={async () => onSaved(await api<T>(`${path}/${archived ? 'restore' : 'archive'}`, { method: 'POST' }))} />
}

export function CatalogList({ kind }: { kind: CatalogKind }) {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const archived = params.get('archived') === 'true'
  const rawPage = Number(params.get('page') || '1')
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 2_147_483_647 ? rawPage : 1
  const query = new URLSearchParams({ page: String(page), page_size: '10', archived: String(archived) })
  if (search) query.set('search', search)
  const result = useResource<Page<CatalogItem>>(`/${kind}?${query}`)
  const config = catalog[kind]
  const suffix = params.size ? `?${params}` : ''
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = new URLSearchParams({ archived: String(data.get('archived')) })
    const text = String(data.get('search') || '').trim()
    if (text) next.set('search', text)
    setParams(next)
  }
  return <><PageHeading section="CATÁLOGO" title={config.title} description={config.description}>
    {identity?.user.role === 'admin' && <Link className="button primary" to={`${config.route}/novo${suffix}`}><Plus size={18} />Novo {config.singular}</Link>}
  </PageHeading>
    <form className="filter-bar" key={`${kind}:${search}:${archived}`} onSubmit={filter} aria-label="Filtrar catálogo">
      <Field label="Buscar no catálogo" name="search" defaultValue={search} maxLength={255} placeholder={kind === 'services' ? 'Nome do serviço' : 'Nome ou SKU'} />
      <div className="form-field"><label htmlFor="catalog-archived">Situação</label><select id="catalog-archived" name="archived" defaultValue={String(archived)}><option value="false">Ativos</option><option value="true">Arquivados</option></select></div>
      <button className="button secondary"><Search size={17} />Filtrar</button>{(search || archived) && <button className="button secondary" type="button" onClick={() => setParams({})}>Limpar</button>}
    </form>
    {result.loading && <Feedback message="Carregando catálogo…" />}
    {result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>{result.data.items.length === 0 ? <div className="empty-state"><h2>{search ? 'Nenhum resultado para estes filtros.' : archived ? 'Nenhum registro arquivado.' : 'Seu catálogo começa aqui.'}</h2><p>{search || archived ? 'Altere os filtros para consultar outros registros.' : `Cadastre seu primeiro ${config.singular} para começar.`}</p></div> :
      <div className="catalog-grid">{result.data.items.map((item) => <Link className="catalog-card" key={item.id} to={`${config.route}/${item.id}${suffix}`}>
        <div className="record-main"><h2>{item.name}</h2><ArrowUpRight size={18} /></div>
        {'sku' in item && <p className="muted">SKU: {item.sku || 'Não informado'}</p>}
        {'purchase_cost' in item && <p className="catalog-value">{identity!.company.currency} {decimalText(item.purchase_cost)} <small>/ {decimalText(item.purchase_quantity)} {item.purchase_unit_code}</small></p>}
        {'base_price' in item && <p className="catalog-value">{identity!.company.currency} {decimalText(item.base_price)}</p>}
        <span className={`record-status ${item.archived_at ? '' : 'is-active'}`}>{item.archived_at ? 'Arquivado' : 'Ativo'}</span>
      </Link>)}</div>}
      <Pagination page={result.data} onChange={(nextPage) => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next) }} />
    </>}
  </>
}
