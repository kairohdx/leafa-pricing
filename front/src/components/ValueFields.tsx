import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { currencies, currencySymbol, decimalInput, pastedMoney, rounded } from '../pages/catalog/decimals'
import { Field, SelectField } from './Forms'

export function QuantityField(props: Parameters<typeof Field>[0]) {
  return <Field {...props} inputMode="decimal" value={typeof props.value === 'string' ? props.value.replace('.', ',') : props.value} />
}

export function phoneDisplay(value: string) {
  if (value.startsWith('+') || !/^[\d\s()-]*$/.test(value)) return value
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return value
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`
}

export function CurrencyField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return <SelectField label="Moeda" value={value} onChange={onChange} error={error}>{!currencies[value] && <option value={value}>{value}</option>}{Object.entries(currencies).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</SelectField>
}

type MoneyProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { label: string; value: string; currency: string; onChange: (value: string) => void; error?: string; hint?: string }
export function MoneyField({ label, value, currency, onChange, error, hint, ...props }: MoneyProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | undefined>(undefined)
  const [, rerender] = useState(0)
  useLayoutEffect(() => {
    if (caret.current !== undefined) {
      input.current?.setSelectionRange(caret.current, caret.current)
      caret.current = undefined
    }
  })
  const [problem, setProblem] = useState('')
  // Explicit comma entry is retained until blur; ordinary digit entry uses cents.
  const typed = useRef('')
  const [explicit, setExplicit] = useState<string | null>(null)
  const display = explicit ?? (value ? rounded(value, 2).replace('.', ',') : '')
  function commit(next: string, caret?: number) {
    try {
      if (next) decimalInput(next, 'money', 'amount')
      setProblem(''); input.current?.setCustomValidity(''); onChange(next)
      setCaret(caret)
    } catch { setProblem('Informe um valor entre zero e 92.233.720.368.547.758,07.'); input.current?.setCustomValidity('Valor fora do limite.') }
  }
  function setCaret(position?: number) { caret.current = position; rerender(revision => revision + 1) }
  return <div className="form-field"><label htmlFor={id}>{label}</label><div className="money-input"><span aria-hidden="true">{currencySymbol(currency)}</span><input {...props} ref={input} id={id} inputMode="decimal" value={display} aria-invalid={Boolean(error || problem)} aria-describedby={`${id}-help`}
    onFocus={() => { typed.current = '' }} onBlur={() => { setExplicit(null); typed.current = '' }}
    onPaste={event => {
      event.preventDefault()
      try {
        const element = event.currentTarget
        const start = element.selectionStart ?? 0
        const end = element.selectionEnd ?? display.length
        const text = event.clipboardData.getData('text')
        // A complete pasted amount is interpreted in reais/dollars, never as cents.
        // A selection inside an existing amount replaces precisely that fragment.
        const partial = display && (start > 0 || end < display.length)
        const next = pastedMoney(partial ? display.slice(0, start) + text + display.slice(end) : text)
        setExplicit(null); typed.current = ''; commit(next, partial ? start + text.length : next.length)
      } catch (cause) { setProblem((cause as Error).message); input.current?.setCustomValidity('Formato de colagem inválido.') }
    }}
    onKeyDown={event => {
      const element = event.currentTarget
      if (event.key === ',' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        const whole = typed.current || value.split('.')[0] || '0'
        setExplicit(`${whole},`); commit(`${whole}.00`); typed.current = ''
      } else if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
        if (element.selectionStart === 0 && element.selectionEnd === display.length) { typed.current = event.key; setExplicit(null) }
        else typed.current += event.key
      } else if (!['Shift', 'Tab'].includes(event.key)) typed.current = ''
    }}
    onChange={event => {
      const raw = event.target.value
      if (explicit !== null) {
        if (!/^\d*,?\d{0,2}$/.test(raw)) { setProblem('Informe no máximo dois dígitos depois da vírgula.'); input.current?.setCustomValidity('Use até duas casas decimais.'); return }
        setExplicit(raw); commit(raw ? rounded(raw.replace(',', '.') || '0', 2) : ''); return
      }
      if (!/^[\d,]*$/.test(raw)) { setProblem('Use apenas números; valores negativos não são permitidos.'); input.current?.setCustomValidity('Use apenas números.'); return }
      const digits = raw.replaceAll(',', '')
      const next = digits ? `${digits.padStart(3, '0').slice(0, -2)}.${digits.padStart(3, '0').slice(-2)}` : ''
      const right = raw.length - (event.target.selectionStart ?? raw.length)
      commit(next ? rounded(next, 2) : '', Math.max(0, (next ? rounded(next, 2).length : 0) - right))
    }} /></div><small id={`${id}-help`} className={error || problem ? 'field-error' : 'field-hint'}>{error || problem || hint || 'Digite só os números. Ex.: 1234 vira 12,34.'}</small></div>
}
