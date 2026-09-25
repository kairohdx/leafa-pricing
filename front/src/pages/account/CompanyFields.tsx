import { timezones as zones } from '../../components/dates'
import { useState } from 'react'
import { CurrencyField } from '../../components/ValueFields'
import { Field, SelectField } from '../../components/Forms'

export type CompanyDraft = { name: string; slug: string; currency: string; timezone: string }
export const emptyCompany: CompanyDraft = { name: '', slug: '', currency: 'BRL', timezone: 'America/Sao_Paulo' }

export function CompanyFields({ value, onChange, errors, prefix = '' }: {
  value: CompanyDraft; onChange: (value: CompanyDraft) => void; errors: Record<string, string>; prefix?: string
}) {
  const [customSlug, setCustomSlug] = useState(Boolean(value.slug))
  return <div className="form-grid">
    <Field label="Nome da empresa" required maxLength={255} autoComplete="organization" value={value.name} error={errors[`${prefix}name`]} onChange={(event) => onChange({ ...value, name: event.target.value, ...(!customSlug ? { slug: event.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) } : {}) })} />
    <Field label="Endereço da empresa no sistema" required maxLength={60} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" hint="Use letras minúsculas, números e hífens. Ex.: meu-atelie" value={value.slug} error={errors[`${prefix}slug`]} onChange={(event) => { setCustomSlug(true); onChange({ ...value, slug: event.target.value }) }} />
    <CurrencyField error={errors[`${prefix}currency`]} value={value.currency} onChange={currency => onChange({ ...value, currency })} />
    <SelectField error={errors[`${prefix}timezone`]} label="Fuso horário" value={value.timezone} onChange={timezone => onChange({ ...value, timezone })}>{!zones[value.timezone] && <option value={value.timezone}>{value.timezone}</option>}{Object.entries(zones).map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}</SelectField>
  </div>
}