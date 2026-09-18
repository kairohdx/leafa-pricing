import { useState } from 'react'
import { useResource, type Page } from '../../api/hooks'
import { Field } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { LoadError } from '../catalog/Shared'

export function Picker<T extends { id: string; name: string }>({ path, label, onSelect }: { path: string; label: string; onSelect: (item: T) => void }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const result = useResource<Page<T>>(`${path}?${new URLSearchParams({ search, page: String(page), page_size: '5', archived: 'false' })}`)
  return <section className="picker-panel" aria-label={label}><Field label={`Buscar ${label}`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} maxLength={255} />
    {result.loading && <Feedback message="Buscando opções…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>{!result.data.items.length && <p>Nenhuma opção ativa encontrada.</p>}<div className="picker-options">{result.data.items.map((item) => <button className="button secondary" type="button" key={item.id} onClick={() => onSelect(item)}>{item.name}</button>)}</div><Pagination page={result.data} onChange={setPage} /></>}
  </section>
}
