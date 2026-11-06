import { describe, expect, it } from 'vitest'
import { generateSlotIntervals } from '../src/domain/schedule.js'
import { MONDAY_8AM_MSK, owner } from './helpers.js'

const iso = (date: Date) => date.toISOString()

describe('generateSlotIntervals', () => {
  it('covers working hours of working days within the booking window', () => {
    const slots = generateSlotIntervals(owner, 30, MONDAY_8AM_MSK)

    // 14 days from Monday include 10 working days, 18 half-hour slots each.
    expect(slots).toHaveLength(180)
    expect(iso(slots[0]!.start)).toBe('2026-11-09T06:00:00.000Z')
    expect(iso(slots[0]!.end)).toBe('2026-11-09T06:30:00.000Z')
    expect(iso(slots.at(-1)!.end)).toBe('2026-11-20T15:00:00.000Z')
  })

  it('skips non-working days', () => {
    const slots = generateSlotIntervals(owner, 60, MONDAY_8AM_MSK)
    const saturday = slots.filter((slot) => iso(slot.start).startsWith('2026-11-14'))
    expect(saturday).toHaveLength(0)
  })

  it('steps by the event duration and never runs past the end of the workday', () => {
    const slots = generateSlotIntervals(owner, 45, MONDAY_8AM_MSK)
    const monday = slots.filter((slot) => iso(slot.start).startsWith('2026-11-09'))

    expect(monday).toHaveLength(12)
    expect(iso(monday[1]!.start)).toBe('2026-11-09T06:45:00.000Z')
    expect(iso(monday.at(-1)!.end)).toBe('2026-11-09T15:00:00.000Z')
  })

  it('drops slots that have already started', () => {
    const now = new Date('2026-11-09T09:10:00Z') // 12:10 in Moscow
    const slots = generateSlotIntervals(owner, 30, now)
    expect(iso(slots[0]!.start)).toBe('2026-11-09T09:30:00.000Z')
  })

  it('uses the owner time zone to decide what "today" is', () => {
    // 23:30 on Sunday in UTC is already Monday 02:30 in Moscow.
    const slots = generateSlotIntervals(owner, 60, new Date('2026-11-08T23:30:00Z'))
    expect(iso(slots[0]!.start)).toBe('2026-11-09T06:00:00.000Z')
  })
})
