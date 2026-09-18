import { createContext, useCallback, useContext, useId } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useResource, type Page } from '../../api/hooks'
import { Feedback } from '../../components/Feedback'
import type { Unit } from './types'

type UnitsState = { data?: Unit[]; loading: boolean; error?: string; reload: () => void }
const UnitsContext = createContext<UnitsState | null>(null)

export function CatalogLayout() {
  const { api } = useAuth()
  const load = useCallback(async (path: string, signal: AbortSignal) => {
    const units: Unit[] = []
    let page = 1
    while (true) {
      const result = await api<Page<Unit>>(`${path}?page=${page}&page_size=100`, { signal })
      units.push(...result.items)
      if (!result.has_next) return units
      page++
    }
  }, [api])
  const units = useResource<Unit[]>('/units', load)
  return <UnitsContext.Provider value={units}><Outlet /></UnitsContext.Provider>
}

export function useUnits() {
  const units = useContext(UnitsContext)
  if (!units) throw new Error('CatalogLayout is required')
  return units
}

export function UnitSelect({ label = 'Unidade', value, onChange, baseCode, error }: {
  label?: string; value: string; onChange: (code: string) => void; baseCode?: string; error?: string
}) {
  const units = useUnits()
  const id = useId()
  const dimension = baseCode ? units.data?.find((unit) => unit.code === baseCode)?.dimension_id : undefined
  const options = units.data?.filter((unit) => !baseCode || unit.dimension_id === dimension) || []
  return <div className="form-field"><label htmlFor={id}>{label}</label>
    <select id={id} value={value} required disabled={!options.length} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
      <option value="">Selecione uma unidade</option>{options.map((unit) => <option key={unit.code} value={unit.code}>{unit.code} — {unit.name}</option>)}
    </select>
    {error && <small className="field-error" id={`${id}-error`}>{error}</small>}
    {units.loading && <Feedback message="Carregando unidades…" />}
    {units.error && <><Feedback message={units.error} error /><button className="button secondary" type="button" onClick={units.reload}>Recarregar unidades</button></>}
    {units.data && !options.length && <p className="info-note">Nenhuma unidade compatível disponível. Solicite a configuração do catálogo de unidades ao responsável pelo sistema.</p>}
  </div>
}
