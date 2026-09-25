import { MoneyField } from '../../components/ValueFields'
import { decimalText, moneyText } from '../catalog/decimals'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { Field, SelectField } from '../../components/Forms'
import { errorMessage } from '../../api/client'

export const strategies = {
  markup_percent: { name: 'Acréscimo sobre custo', description: 'Adicione uma porcentagem sobre o custo do produto. R$ 100 + 30% → R$ 130', fields: { percentage: 'Acréscimo (%)' } },
  target_margin: { name: 'Margem desejada', description: 'Defina quanto do preço final deve representar sua margem. Custo R$ 100 + margem de 30% → R$ 142,86', fields: { margin: 'Margem (%)' } },
  margin_fees: { name: 'Margem + taxas', description: 'Considere taxas de venda e a margem que deseja manter.', fields: { margin: 'Margem (%)', fees: 'Taxas/comissões (%)', fixed_cost: 'Custo adicional fixo' } },
  cost_multiplier: { name: 'Multiplicar o custo', description: 'Ex.: vendo meus produtos por 2,5× o custo.', fields: { multiplier: 'Multiplicador' } },
  fixed_addition: { name: 'Valor fixo sobre o custo', description: 'Adicione sempre o mesmo valor ao custo.', fields: { addition: 'Valor adicional' } },
}
export function strategyName(key: string) { return strategies[key as keyof typeof strategies]?.name || 'Configuração antiga — escolha uma estratégia para calcular' }
export type Calculation = { status: string; reason: string | null; base_cost: string | null; price_before_adjustment: string | null; suggested_price: string | null; adjustment: string | null; details: { fees_amount?: string; resulting_margin_percent?: string | null } }

export function parameterError(key: string, parameters: Record<string, unknown>) {
  const value = String(parameters[key] ?? '')
  if (!/^\d+(?:\.\d{1,12})?$/.test(value)) return 'Informe um número positivo ou zero, com até 12 casas decimais.'
  const scaled = (text: string) => { const [whole, fraction = ''] = text.split('.'); return BigInt(whole + fraction.padEnd(12, '0')) }
  if (key === 'multiplier' && scaled(value) === 0n) return 'Informe um multiplicador maior que zero.'
  if (key === 'margin' || key === 'fees') {
    const other = String(parameters[key === 'margin' ? 'fees' : 'margin'] ?? '0')
    if (/^\d+(?:\.\d{1,12})?$/.test(other) && scaled(value) + scaled(other) >= 100000000000000n) return 'A margem somada às taxas deve ser menor que 100%.'
  }
  return undefined
}

export function usePreview<T>(path: string, body: string, enabled = true) {
  const { api, identity } = useAuth()
  const owner = `${identity?.company.id}:${identity?.user.id}:${path}`
  const key = `${owner}:${body}`
  const [state, setState] = useState<{ body: string; owner?: string; data?: T; error?: string }>({ body: '' })
  useEffect(() => {
    if (!enabled) return
    let active = true
    const timer = setTimeout(() => {
      api<T>(path, { method: 'POST', body }).then(data => { if (active) setState({ body: key, owner, data }) }).catch(error => { if (active) setState({ body: key, owner, error: `Não foi possível calcular. ${errorMessage(error)}` }) })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [api, path, body, key, owner, enabled])
  return { ...(state.owner === owner ? state : { body }), stale: state.body !== key || !enabled }
}

export function StrategyFields({ strategy, parameters, onChange, errors = {} }: { errors?: Record<string, string>; strategy: string; parameters: Record<string, unknown>; onChange: (strategy: string, parameters: Record<string, unknown>) => void }) {
  const definition = strategies[strategy as keyof typeof strategies]
  const drafts = useRef<Record<string, Record<string, unknown>>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const { identity } = useAuth()
  function choose(key: string) {
    if (key === strategy) return
    setTouched({})
    drafts.current[strategy] = parameters
    if (drafts.current[key]) { onChange(key, drafts.current[key]); return }
    const fields = strategies[key as keyof typeof strategies].fields
    onChange(key, { ...Object.fromEntries(Object.keys(fields).map(field => [field, field === 'multiplier' ? '1' : '0'])), rounding: 'none' })
  }
  return <section><h3>Como você quer calcular o preço?</h3><div className="catalog-grid">{Object.entries(strategies).map(([key, value]) => <button type="button" className="catalog-card" aria-pressed={strategy === key} key={key} onClick={() => choose(key)}><strong>{strategy === key && <span aria-hidden="true">✓ </span>}{value.name}</strong><p>{value.description}</p></button>)}</div>
    {!definition && <p role="status">Esta regra antiga precisa de uma estratégia válida para calcular preços.</p>}
    {definition && <div className="form-grid">{Object.entries(definition.fields).map(([key, label]) => ['fixed_cost', 'addition'].includes(key) ? <MoneyField key={key} label={label} currency={identity?.company.currency || 'BRL'} value={String(parameters[key] ?? '')} onChange={value => onChange(strategy, { ...parameters, [key]: value })} /> : <Field key={key} label={label} error={errors[`parameters.${key}`] || (touched[key] ? parameterError(key, parameters) : undefined)} onBlur={() => setTouched({ ...touched, [key]: true })} required inputMode="decimal" value={String(parameters[key] ?? '').replace('.', ',')} onChange={event => onChange(strategy, { ...parameters, [key]: event.target.value.replace(',', '.') })} />)}</div>}
    <SelectField label="Arredondamento comercial" value={String(parameters.rounding || 'none')} onChange={rounding => onChange(strategy, { ...parameters, rounding })}><option value="none">Sem ajuste comercial</option><option value="integer">Para cima, valor inteiro</option><option value="ending_90">Terminar em ,90</option><option value="ending_99">Terminar em ,99</option></SelectField>
  </section>
}

export function RuleSimulator({ strategy, parameters }: { strategy: string; parameters: Record<string, unknown> }) {
  const { identity } = useAuth()
  const [cost, setCost] = useState('100')
  const preview = usePreview<Calculation>('/pricing-rules/preview', JSON.stringify({ strategy_key: strategy, parameters, base_cost: cost.replace(',', '.') }), Boolean(cost) && Object.entries(parameters).every(([key, value]) => key === 'rounding' || /^\d+(?:\.\d+)?$/.test(String(value))))
  const currency = identity?.company.currency || 'BRL'
  const value = (amount: string | null | undefined) => amount == null ? 'Indisponível' : moneyText(amount, currency)
  return <section className="trading-section"><h3>Teste sua regra</h3><MoneyField label="Custo para testar" currency={currency} value={cost} onChange={setCost} />
    <p role="status">{preview.stale ? preview.data ? "Atualizando… Resultado anterior." : cost ? "Calculando…" : "Informe um custo para testar." : "Cálculo atualizado."}</p><div className="preview-result" aria-busy={preview.stale}>{preview.error ? <p role="alert">{preview.error}</p> : !preview.data ? <p>Calculando…</p> : <><p>{preview.data.reason}</p><p className="metric-value">{value(preview.data.suggested_price)}</p><details><summary>Ver cálculo detalhado</summary><dl className="details"><div><dt>Custo informado</dt><dd>{value(preview.data.base_cost)}</dd></div><div><dt>Preço antes do arredondamento (aproximado)</dt><dd>{value(preview.data.price_before_adjustment)}</dd></div><div><dt>Ajuste aplicado</dt><dd>{value(preview.data.adjustment)}</dd></div><div><dt>Preço sugerido final</dt><dd>{value(preview.data.suggested_price)}</dd></div><div><dt>Taxas</dt><dd>{value(preview.data.details.fees_amount)}</dd></div><div><dt>Margem após taxas e custo adicional</dt><dd>{preview.data.details.resulting_margin_percent == null ? 'Indisponível' : `${decimalText(preview.data.details.resulting_margin_percent, 2)}%`}</dd></div></dl><p>Preço bruto exato: {preview.data.price_before_adjustment?.replace(".", ",")}</p><p>Margem exata: {preview.data.details.resulting_margin_percent?.replace(".", ",") ?? "Indisponível"}%</p></details></>}</div>
  </section>
}
