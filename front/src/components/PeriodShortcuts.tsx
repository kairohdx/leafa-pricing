import { localDateTime, shiftDate } from './dates'

export function PeriodShortcuts({ timezone }: { timezone: string }) {
  const periods: [string, number][] = [['Hoje', 0], ['Últimos 7 dias', 6], ['Este mês', -1], ['Últimos 30 dias', 29]]
  return <>{periods.map(([label, days]) => <button className="button secondary" type="button" key={label} onClick={event => {
    const today = localDateTime(new Date().toISOString(), timezone).slice(0, 10)
    const form = event.currentTarget.form!
    ;(form.elements.namedItem('start') as HTMLInputElement).value = days === -1 ? `${today.slice(0, 7)}-01` : shiftDate(today, -days)
    ;(form.elements.namedItem('end') as HTMLInputElement).value = today
    form.requestSubmit()
  }}>{label}</button>)}</>
}
