import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} мин`
  if (rest === 0) return `${hours} ч`
  return `${hours} ч ${rest} мин`
}

export function formatTime(iso: string | Date): string {
  return format(new Date(iso), 'HH:mm')
}

export function formatTimeRange(startAt: string, endAt: string): string {
  return `${formatTime(startAt)} – ${formatTime(endAt)}`
}

/** «вторник, 10 ноября» */
export function formatDayLong(date: string | Date): string {
  return format(new Date(date), 'EEEE, d MMMM', { locale: ru })
}

/** «10 нояб., вт» */
export function formatDayShort(date: string | Date): string {
  return format(new Date(date), 'd MMM, EEEEEE', { locale: ru })
}

/** Local calendar day key, used to group slots and bookings by the viewer's date. */
export function dayKey(date: string | Date): string {
  return format(new Date(date), 'yyyy-MM-dd')
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
