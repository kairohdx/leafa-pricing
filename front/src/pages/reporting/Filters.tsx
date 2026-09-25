import { PeriodShortcuts } from '../../components/PeriodShortcuts'
import { useAuth } from '../../auth/AuthProvider'
import { currencies } from '../catalog/decimals'
import { dateBoundary, filterDate } from '../../components/dates'
import type { FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { useFormAction } from '../../api/hooks'
import { Field, FormFeedback } from '../../components/Forms'

export type Filter = { key: string; label: string; maxLength?: number; hint?: string; options?: Record<string, string>; advanced?: boolean }
export function periodParams(data: FormData, required: boolean, timezone = 'America/Sao_Paulo') {
  const params = new URLSearchParams()
  for (const key of ['start', 'end']) {
    const value = String(data.get(key) || '').trim()
    if (value || required) params.set(key, dateBoundary(value, timezone, key === 'end'))
  }
  if (params.has('start') && params.has('end')) {
    const duration = Date.parse(params.get('end')!) - Date.parse(params.get('start')!)
    if (duration <= 0 || (required && duration > 366 * 86400000)) throw new ApiError(422, [{ field: 'end', code: 'invalid_period' }])
  }
  return params
}

export function ReportFilters({ params, onChange, analytics = false, fields = [] }: { params: URLSearchParams; onChange: (params: URLSearchParams) => void; analytics?: boolean; fields?: Filter[] }) {
  const { identity } = useAuth()
  const timezone = identity!.company.timezone
  const form = useFormAction()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await form.run(async () => {
      const next = periodParams(data, analytics, timezone)
      for (const field of fields) {
        const value = String(data.get(field.key) || '').trim()
        if (value) {
          if (field.key === 'currency' && !/^[A-Z]{3}$/.test(value)) throw new ApiError(422, [{ field: field.key, code: 'currency' }])
          if (['actor_user_id', 'entity_id'].includes(field.key) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(422, [{ field: field.key, code: 'uuid' }])
          next.set(field.key, value)
        }
      }
      onChange(next)
    })
  }
  const renderFields = (entries: Filter[]) => entries.map((field) => field.key === "currency" ? <div className="form-field" key={field.key}><label htmlFor="report-currency">Moeda</label><select id="report-currency" name="currency" defaultValue={params.get("currency") || identity!.company.currency}>{!currencies[params.get("currency") || identity!.company.currency] && <option>{params.get("currency") || identity!.company.currency}</option>}{Object.entries(currencies).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div> : field.options ? <div className="form-field" key={field.key}><label htmlFor={`filter-${field.key}`}>{field.label}</label><select id={`filter-${field.key}`} name={field.key} defaultValue={params.get(field.key) || ""}><option value="">Todas as opções</option>{params.get(field.key) && !field.options[params.get(field.key)!] && <option>{params.get(field.key)}</option>}{Object.entries(field.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div> : <Field key={field.key} label={field.label} name={field.key} maxLength={field.maxLength} hint={field.hint} defaultValue={params.get(field.key) || ''} error={form.fields[field.key]} required={field.key === 'currency'} />)
  return <form className="detail-card report-filters" onSubmit={submit} key={params.toString()}><FormFeedback state={form} /><div className="form-grid">
    <Field label="De" type="date" name="start" defaultValue={filterDate(params.get("start"), timezone)} required={analytics} error={form.fields.start}  />
    <Field label="Até" type="date" name="end" defaultValue={filterDate(params.get("end"), timezone, true)} required={analytics} error={form.fields.end ? `Informe fim posterior ao início${analytics ? ', com período de até 366 dias' : ''}.` : undefined} hint="Inclui o dia escolhido." />
    {renderFields(fields.filter(field => !field.advanced))}
    {fields.some(field => field.advanced) && <details><summary>Filtros avançados</summary>{renderFields(fields.filter(field => field.advanced))}</details>}
    </div><div className="form-actions"><PeriodShortcuts timezone={timezone} /><button className="button primary" disabled={form.busy}>Aplicar filtros</button>{!analytics && <button className="button secondary" type="button" onClick={() => onChange(new URLSearchParams())}>Limpar filtros</button>}</div>
  </form>
}
