import { TZDate } from '@date-fns/tz'
import type { Interval, Owner } from './model.js'

const MINUTE_MS = 60_000

/**
 * Candidate slots for an event type: back-to-back intervals of `durationMinutes` inside the owner's
 * working hours, on working days, from today (owner's time zone) for `bookingWindowDays` days.
 * Slots that have already started are excluded.
 */
export function generateSlotIntervals(owner: Owner, durationMinutes: number, now: Date): Interval[] {
  const today = new TZDate(now, owner.timezone)
  const intervals: Interval[] = []

  for (let dayOffset = 0; dayOffset < owner.bookingWindowDays; dayOffset += 1) {
    const dayStart = new TZDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + dayOffset,
      owner.workdayStart.hours,
      owner.workdayStart.minutes,
      0,
      0,
      owner.timezone,
    )
    if (!owner.workingDays.has(isoWeekday(dayStart))) continue

    const dayEnd = new TZDate(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      owner.workdayEnd.hours,
      owner.workdayEnd.minutes,
      0,
      0,
      owner.timezone,
    ).getTime()

    for (
      let start = dayStart.getTime();
      start + durationMinutes * MINUTE_MS <= dayEnd;
      start += durationMinutes * MINUTE_MS
    ) {
      if (start <= now.getTime()) continue
      intervals.push({ start: new Date(start), end: new Date(start + durationMinutes * MINUTE_MS) })
    }
  }

  return intervals
}

function isoWeekday(date: TZDate): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}
