import { dateBoundary, localDateTime, shiftDate } from '../../components/dates'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useResource } from '../../api/hooks'
import { PageHeading } from '../../components/Forms'
import { Feedback } from '../../components/Feedback'
import { LoadError } from '../catalog/Shared'
import { moneyText } from '../catalog/decimals'
import { dateText } from '../trading/validation'
import { ReportFilters } from './Filters'

type Summary = { currency: string; sales_count: number; final_total: string; cost_total: string | null; cost_coverage: number }
type Point = { start: string; sales_count: number; final_total: string }
type Series = { currency: string; timezone: string; points: Point[] }
type Report = { summary: Summary; series: Series }

export function barWidths(values: string[]): number[] {
  const cents = values.map((value) => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole + fraction.padEnd(2, '0')) })
  const max = cents.reduce((a, b) => a > b ? a : b, 0n)
  return cents.map((value) => max === 0n ? 0 : Number(value * 10000n / max) / 100)
}

export function AnalyticsPage() {
  const { identity, api } = useAuth()
  const [params, setParams] = useSearchParams()
  const [initialPeriod] = useState(() => { const today = localDateTime(new Date().toISOString(), identity!.company.timezone).slice(0, 10); return { start: dateBoundary(shiftDate(today, -29), identity!.company.timezone), end: dateBoundary(today, identity!.company.timezone, true) } })
  const query = new URLSearchParams({ start: params.get('start') || initialPeriod.start, end: params.get('end') || initialPeriod.end, currency: params.get('currency') || identity!.company.currency })
  const load = useCallback(async (path: string, signal: AbortSignal): Promise<Report> => {
    const [summary, series] = await Promise.all([api<Summary>(`/analytics/summary${path}`, { signal }), api<Series>(`/analytics/sales-series${path}`, { signal })])
    return { summary, series }
  }, [api])
  const result = useResource<Report>(`?${query}`, load)
  const widths = result.data ? barWidths(result.data.series.points.map((point) => point.final_total)) : []
  return <><PageHeading section="RESULTADOS" title="Indicadores" description={`Vendas concluídas, agrupadas no fuso ${identity!.company.timezone}. O período inicial cobre os últimos 30 dias incluindo hoje.`}><button className="button secondary" disabled={result.loading} onClick={result.reload}>Atualizar indicadores</button></PageHeading>
    <ReportFilters params={query} analytics onChange={setParams} fields={[{ key: 'currency', label: 'Moeda', maxLength: 3, hint: 'Três letras maiúsculas, por exemplo BRL. Filtra a moeda histórica, sem câmbio.' }]} />
    {result.loading && <Feedback message="Carregando indicadores…" />}{result.error && <LoadError error={result.error} retry={result.reload} />}
    {result.data && <>
      <div className="catalog-grid report-metrics" aria-label="Resumo do período">
        <section className="detail-card"><h2>Vendas concluídas</h2><p className="metric-value">{result.data.summary.sales_count}</p></section>
        <section className="detail-card"><h2>Total final</h2><p className="metric-value">{moneyText(result.data.summary.final_total, result.data.summary.currency)}</p></section>
        <section className="detail-card"><h2>Custo conhecido</h2><p className="metric-value">{result.data.summary.cost_total === null ? 'Indisponível' : moneyText(result.data.summary.cost_total, result.data.summary.currency)}</p><p>Cobertura: {result.data.summary.cost_coverage} de {result.data.summary.sales_count} vendas.</p>{result.data.summary.cost_coverage > 0 && result.data.summary.cost_coverage < result.data.summary.sales_count && <p className="info-note">Custo parcial: há vendas sem custo registrado.</p>}</section>
      </div>
      {result.data.summary.sales_count === 0 && <div className="empty-state"><h2>Nenhuma venda concluída neste período e moeda.</h2><p>Rascunhos e vendas canceladas não entram nos indicadores.</p></div>}
      <section className="detail-card series-card"><h2>Vendas por dia</h2><p className="muted">{result.data.series.timezone} · {result.data.series.currency}. Primeiro e último dia podem estar parcialmente cobertos pelo filtro. As barras comparam o total diário; valores exatos estão na tabela.</p>
        <div className="daily-chart" role="img" aria-label="Barras do total final por dia. Consulte os mesmos valores na tabela abaixo.">{result.data.series.points.map((point, index) => <div className="daily-bar-row" key={point.start}><span>{new Intl.DateTimeFormat('pt-BR', { timeZone: result.data!.series.timezone, day: '2-digit', month: '2-digit' }).format(new Date(point.start))}</span><span className="bar-track"><span style={{ width: `${widths[index]}%` }} /></span></div>)}</div>
        <div className="report-table-wrap" tabIndex={0} role="region" aria-label="Valores diários"><table className="report-table"><caption>Totais diários em {result.data.series.currency}</caption><thead><tr><th scope="col">Início do dia</th><th scope="col">Vendas</th><th scope="col">Total final</th></tr></thead><tbody>{result.data.series.points.map((point) => <tr key={point.start}><th scope="row">{dateText(point.start, result.data!.series.timezone)}</th><td>{point.sales_count}</td><td>{moneyText(point.final_total, result.data!.series.currency)}</td></tr>)}</tbody></table></div>
      </section>
      <p className="info-note">Custos indisponíveis não representam zero. Os dados são consultados novamente ao abrir esta tela; use Atualizar indicadores para mudanças feitas em outra aba.</p>
    </>}
  </>
}
