import { ApiError } from '../api/client'

export const timezones: Record<string, string> = { 'America/Sao_Paulo': 'Brasília', 'America/Manaus': 'Manaus', 'America/Rio_Branco': 'Rio Branco', 'Europe/Lisbon': 'Lisboa', 'Europe/London': 'Londres', 'America/New_York': 'Nova York', UTC: 'UTC' }
export function timezoneLabel(zone: string) { return timezones[zone] || zone }

export function localDateTime(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant))
  const part = (key: string) => parts.find(p => p.type === key)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
export function zonedInstant(local: string, timezone: string, field = 'occurred_at'): string {
  const fail = () => { throw new ApiError(422, [{ field, code: 'invalid_datetime' }]) }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return fail()
  const wall = Date.parse(`${local}:00Z`)
  if (!Number.isFinite(wall)) return fail()
  let candidate = wall
  for (let i = 0; i < 5; i++) {
    const formatted = localDateTime(new Date(candidate).toISOString(), timezone)
    if (formatted === local) return new Date(candidate).toISOString()
    candidate += wall - Date.parse(`${formatted}:00Z`)
  }
  return fail() // Nonexistent local time during a daylight saving transition.
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function dateBoundary(date: string, timezone: string, end = false) {
  return zonedInstant(`${end ? shiftDate(date, 1) : date}T00:00`, timezone, end ? 'end' : 'start')
}
export function filterDate(instant: string | null, timezone: string, end = false) {
  if (!instant) return ''
  const date = localDateTime(instant, timezone).slice(0, 10)
  return end ? shiftDate(date, -1) : date
}
