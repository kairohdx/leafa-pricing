import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Feedback } from './Feedback'
import type { useFormAction } from '../api/hooks'

export function Field({ label, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <input {...input} id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-help` : undefined} />
    {(error || hint) && <small id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>{error || hint}</small>}
  </div>
}

export function SelectField({ label, value, onChange, children, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean
}) {
  const id = useId()
  return <div className="form-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select></div>
}

export function FormFeedback({ state }: { state: Pick<ReturnType<typeof useFormAction>, 'error' | 'success'> }) {
  return <>{state.error && <Feedback message={state.error} error />}{state.success && <div className="feedback success-message" role="status"><CheckCircle2 size={18} aria-hidden="true" />{state.success}</div>}</>
}

export type PersonDraft = { name: string; username: string; email: string; phone: string }
export const emptyPerson: PersonDraft = { name: '', username: '', email: '', phone: '' }
export function PersonFields({ value, onChange, errors, prefix = '' }: {
  value: PersonDraft; onChange: (value: PersonDraft) => void; errors: Record<string, string>; prefix?: string
}) {
  return <div className="form-grid">
    <Field label="Nome completo" name="name" autoComplete="name" required maxLength={255} value={value.name} error={errors[`${prefix}name`]} onChange={(event) => onChange({ ...value, name: event.target.value })} />
    <Field label="Nome de usuário" name="username" autoComplete="username" required maxLength={60} value={value.username} error={errors[`${prefix}username`]} onChange={(event) => onChange({ ...value, username: event.target.value })} />
    <Field label="Email" name="email" type="email" autoComplete="email" required maxLength={255} value={value.email} error={errors[`${prefix}email`]} onChange={(event) => onChange({ ...value, email: event.target.value })} />
    <Field label="Telefone" name="phone" type="tel" autoComplete="tel" maxLength={20} value={value.phone} error={errors[`${prefix}phone`]} onChange={(event) => onChange({ ...value, phone: event.target.value })} />
  </div>
}

export function PageHeading({ section, title, description, children }: { section: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{section}</span><h1>{title}</h1><p className="muted">{description}</p></div>{children}</div>
}
