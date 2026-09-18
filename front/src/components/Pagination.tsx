import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Page } from '../api/hooks'

export function Pagination({ page, onChange }: { page: Page<unknown>; onChange: (number: number) => void }) {
  return <nav className="pagination" aria-label="Paginação">
    <span>{page.total} {page.total === 1 ? 'registro' : 'registros'} · Página {page.page} de {Math.max(1, page.total_pages)}</span>
    <div><button type="button" className="icon-button" aria-label="Página anterior" disabled={!page.has_previous} onClick={() => onChange(Math.max(1, Math.min(page.page - 1, page.total_pages)))}><ChevronLeft size={19} /></button><button type="button" className="icon-button" aria-label="Próxima página" disabled={!page.has_next} onClick={() => onChange(page.page + 1)}><ChevronRight size={19} /></button></div>
  </nav>
}
