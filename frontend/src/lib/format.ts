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

const weekdayShort = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

/** ISO weekdays (1 — Monday) → «пн–пт», «пн, ср, пт», «ежедневно». */
export function formatWorkingDays(isoDays: number[]): string {
  const days = [...new Set(isoDays)].sort((a, b) => a - b)
  if (days.length === 7) return 'ежедневно'

  const runs: number[][] = []
  for (const day of days) {
    const run = runs.at(-1)
    if (run && run.at(-1) === day - 1) run.push(day)
    else runs.push([day])
  }
  return runs
    .flatMap((run) =>
      run.length >= 3
        ? [`${weekdayShort[run[0] - 1]}–${weekdayShort[run.at(-1)! - 1]}`]
        : run.map((day) => weekdayShort[day - 1]),
    )
    .join(', ')
}

const dayForms: Record<string, string> = { one: 'день', few: 'дня', many: 'дней', other: 'дня' }

/** 1 день, 3 дня, 14 дней */
export function formatDays(count: number): string {
  return `${count} ${dayForms[new Intl.PluralRules('ru').select(count)]}`
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
