import type { FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { useFormAction } from '../../api/hooks'
import { Field, FormFeedback } from '../../components/Forms'
import { instantInput } from '../trading/validation'

export type Filter = { key: string; label: string; maxLength?: number; hint?: string }
export function periodParams(data: FormData, required: boolean) {
  const params = new URLSearchParams()
  for (const key of ['start', 'end']) {
    const value = String(data.get(key) || '').trim()
    if (value || required) params.set(key, instantInput(value, key))
  }
  if (params.has('start') && params.has('end')) {
    const duration = Date.parse(params.get('end')!) - Date.parse(params.get('start')!)
    if (duration <= 0 || (required && duration > 366 * 86400000)) throw new ApiError(422, [{ field: 'end', code: 'invalid_period' }])
  }
  return params
}

export function ReportFilters({ params, onChange, analytics = false, fields = [] }: { params: URLSearchParams; onChange: (params: URLSearchParams) => void; analytics?: boolean; fields?: Filter[] }) {
  const form = useFormAction()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await form.run(async () => {
      const next = periodParams(data, analytics)
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
  return <form className="detail-card report-filters" onSubmit={submit} key={params.toString()}><FormFeedback state={form} /><div className="form-grid">
    <Field label="Início (inclusivo)" name="start" defaultValue={params.get('start') || ''} required={analytics} error={form.fields.start} hint="Data com fuso: 2026-09-01T00:00:00-03:00" />
    <Field label="Fim (exclusivo)" name="end" defaultValue={params.get('end') || ''} required={analytics} error={form.fields.end ? `Informe fim posterior ao início${analytics ? ', com período de até 366 dias' : ''}.` : undefined} hint="O instante final não entra no período." />
    {fields.map((field) => <Field key={field.key} label={field.label} name={field.key} maxLength={field.maxLength} hint={field.hint} defaultValue={params.get(field.key) || ''} error={form.fields[field.key]} required={field.key === 'currency'} />)}
    </div><div className="form-actions"><button className="button primary" disabled={form.busy}>Aplicar filtros</button>{!analytics && <button className="button secondary" type="button" onClick={() => onChange(new URLSearchParams())}>Limpar filtros</button>}</div>
  </form>
}
