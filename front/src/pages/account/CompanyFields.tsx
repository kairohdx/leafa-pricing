import { Field } from '../../components/Forms'

export type CompanyDraft = { name: string; slug: string; currency: string; timezone: string }
export const emptyCompany: CompanyDraft = { name: '', slug: '', currency: 'BRL', timezone: 'America/Sao_Paulo' }

export function CompanyFields({ value, onChange, errors, prefix = '' }: {
  value: CompanyDraft; onChange: (value: CompanyDraft) => void; errors: Record<string, string>; prefix?: string
}) {
  return <div className="form-grid">
    <Field label="Nome da empresa" required maxLength={255} autoComplete="organization" value={value.name} error={errors[`${prefix}name`]} onChange={(event) => onChange({ ...value, name: event.target.value })} />
    <Field label="Identificador da empresa" required maxLength={60} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" hint="Use letras minúsculas, números e hífens. Ex.: meu-atelie" value={value.slug} error={errors[`${prefix}slug`]} onChange={(event) => onChange({ ...value, slug: event.target.value })} />
    <Field label="Moeda" required minLength={3} maxLength={3} pattern="[A-Z]{3}" hint="Código de 3 letras, como BRL, USD ou EUR." value={value.currency} error={errors[`${prefix}currency`]} onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })} />
    <Field label="Fuso horário" required maxLength={64} hint="Use um fuso IANA, como America/Sao_Paulo ou Europe/Lisbon." value={value.timezone} error={errors[`${prefix}timezone`]} onChange={(event) => onChange({ ...value, timezone: event.target.value })} />
  </div>
}
