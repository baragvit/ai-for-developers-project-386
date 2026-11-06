import { describe, expect, it } from 'vitest'
import type { Interval, Owner } from '../src/domain/model.js'
import { generateSlotIntervals } from '../src/domain/schedule.js'
import { MONDAY_8AM_MSK, owner } from './helpers.js'

const iso = (date: Date) => date.toISOString()

/** Calendar date of a slot start in Moscow, e.g. `2026-11-09`. */
const moscowDay = (slot: Interval) => slot.start.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
const moscowTime = (slot: Interval) =>
  slot.start.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })

const distinctDays = (slots: Interval[]) => [...new Set(slots.map(moscowDay))]

const everyDayOwner: Owner = { ...owner, workingDays: new Set([1, 2, 3, 4, 5, 6, 7]) }

describe('generateSlotIntervals', () => {
  it('covers working hours of working days within the booking window', () => {
    const slots = generateSlotIntervals(owner, 30, MONDAY_8AM_MSK)

    // 14 days from Monday include 10 working days, 18 half-hour slots each.
    expect(slots).toHaveLength(180)
    expect(iso(slots[0]!.start)).toBe('2026-11-09T06:00:00.000Z')
    expect(iso(slots[0]!.end)).toBe('2026-11-09T06:30:00.000Z')
    expect(iso(slots.at(-1)!.end)).toBe('2026-11-20T15:00:00.000Z')
  })

  it('opens the window today and closes it after today + 13 days', () => {
    const wednesday = new Date('2026-11-11T05:00:00Z') // 08:00 in Moscow

    const days = distinctDays(generateSlotIntervals(everyDayOwner, 60, wednesday))

    expect(days).toHaveLength(14)
    expect(days[0]).toBe('2026-11-11')
    expect(days.at(-1)).toBe('2026-11-24')
  })

  it('skips weekends', () => {
    const days = distinctDays(generateSlotIntervals(owner, 60, MONDAY_8AM_MSK))

    expect(days).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ])
  })

  it('lays a 30-minute grid from the start of the workday to 17:30', () => {
    const monday = generateSlotIntervals(owner, 30, MONDAY_8AM_MSK).filter(
      (slot) => moscowDay(slot) === '2026-11-09',
    )

    expect(monday.map(moscowTime)).toEqual([
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00',
      '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    ])
  })

  it('steps a 45-minute grid by the duration, the last slot starting at 17:15', () => {
    const monday = generateSlotIntervals(owner, 45, MONDAY_8AM_MSK).filter(
      (slot) => moscowDay(slot) === '2026-11-09',
    )

    expect(monday.map(moscowTime)).toEqual([
      '09:00', '09:45', '10:30', '11:15', '12:00', '12:45',
      '13:30', '14:15', '15:00', '15:45', '16:30', '17:15',
    ])
    expect(iso(monday.at(-1)!.end)).toBe('2026-11-09T15:00:00.000Z')
  })

  it('drops slots that have already started', () => {
    const now = new Date('2026-11-09T09:10:00Z') // 12:10 in Moscow
    const slots = generateSlotIntervals(owner, 30, now)
    expect(iso(slots[0]!.start)).toBe('2026-11-09T09:30:00.000Z')
  })

  it('treats a slot starting right now as started', () => {
    const now = new Date('2026-11-09T09:00:00Z') // 12:00 in Moscow
    const slots = generateSlotIntervals(owner, 30, now)
    expect(iso(slots[0]!.start)).toBe('2026-11-09T09:30:00.000Z')
  })

  it('returns nothing for today once the workday is over', () => {
    const now = new Date('2026-11-09T15:00:00Z') // 18:00 in Moscow
    const slots = generateSlotIntervals(owner, 30, now)
    expect(moscowDay(slots[0]!)).toBe('2026-11-10')
  })

  it('uses the owner time zone to decide what "today" is', () => {
    // 23:30 on Sunday in UTC is already Monday 02:30 in Moscow.
    const slots = generateSlotIntervals(owner, 60, new Date('2026-11-08T23:30:00Z'))
    expect(iso(slots[0]!.start)).toBe('2026-11-09T06:00:00.000Z')
  })

  it('moves the window with the owner date, not the UTC date', () => {
    // 21:30 on Monday in UTC is Tuesday 00:30 in Moscow, so the window ends on Monday 23 November.
    const days = distinctDays(generateSlotIntervals(everyDayOwner, 60, new Date('2026-11-09T21:30:00Z')))

    expect(days[0]).toBe('2026-11-10')
    expect(days.at(-1)).toBe('2026-11-23')
  })

  it('keeps working hours in owner local time across a DST change', () => {
    const newYork: Owner = { ...owner, timezone: 'America/New_York' }
    // Friday 30 October 2026, 08:00 in New York (EDT); DST ends on Sunday 1 November.
    const slots = generateSlotIntervals(newYork, 60, new Date('2026-10-30T12:00:00Z'))

    expect(iso(slots[0]!.start)).toBe('2026-10-30T13:00:00.000Z')
    expect(iso(slots.find((slot) => iso(slot.start).startsWith('2026-11-02'))!.start)).toBe(
      '2026-11-02T14:00:00.000Z',
    )
  })
})
