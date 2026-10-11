import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function todayLocalIso(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function formatLongDateBr(isoDate: string): string {
  return format(new Date(`${isoDate}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function monthRange(year: number, monthIndex: number) {
  const start = startOfMonth(new Date(year, monthIndex, 1))
  const end = endOfMonth(start)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  }
}

export function monthLabel(year: number, monthIndex: number): string {
  return format(new Date(year, monthIndex, 1), 'MMMM yyyy', { locale: ptBR })
}

export function dateInputValue(date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}
