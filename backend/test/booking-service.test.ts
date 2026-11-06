import { beforeEach, describe, expect, it } from 'vitest'
import type { NewBooking } from '../src/domain/model.js'
import { BookingService } from '../src/services/booking-service.js'
import { seedDemoEventTypes } from '../src/seed.js'
import { InMemoryBookingRepository, InMemoryEventTypeRepository } from '../src/storage/repositories.js'
import { MONDAY_8AM_MSK, owner } from './helpers.js'

const request = (overrides: Partial<NewBooking> = {}): NewBooking => ({
  eventTypeId: 'consultation',
  start: new Date('2026-11-09T06:30:00Z'),
  guestName: 'Иван Петров',
  guestEmail: 'ivan@example.com',
  comment: undefined,
  ...overrides,
})

describe('BookingService', () => {
  let now: Date
  let service: BookingService

  beforeEach(() => {
    now = MONDAY_8AM_MSK
    const eventTypes = new InMemoryEventTypeRepository()
    seedDemoEventTypes(eventTypes)
    service = new BookingService(owner, eventTypes, new InMemoryBookingRepository(), () => now)
  })

  it('books a free slot and marks it as unavailable', () => {
    const result = service.create(request())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.eventTypeName).toBe('Консультация')
    expect(result.value.interval.end.toISOString()).toBe('2026-11-09T07:00:00.000Z')

    const slots = service.listSlots('consultation')
    if (!slots.ok) throw new Error('expected slots')
    const booked = slots.value.find((slot) => slot.interval.start.toISOString() === '2026-11-09T06:30:00.000Z')
    expect(booked?.available).toBe(false)
  })

  it('rejects a second booking for the same time', () => {
    service.create(request())
    const result = service.create(request({ guestName: 'Мария' }))
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'SlotTaken' }) })
  })

  it('rejects an overlapping booking of a different event type', () => {
    service.create(request()) // 09:30–10:00 MSK
    const result = service.create(request({ eventTypeId: 'tech-interview', start: new Date('2026-11-09T06:00:00Z') }))
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'SlotTaken' }) })

    const slots = service.listSlots('tech-interview')
    if (!slots.ok) throw new Error('expected slots')
    expect(slots.value[0]?.available).toBe(false)
    expect(slots.value[1]?.available).toBe(true)
  })

  it.each([
    ['not aligned to the slot grid', '2026-11-09T06:10:00Z'],
    ['in the past', '2026-11-09T04:00:00Z'],
    ['outside working hours', '2026-11-09T16:00:00Z'],
    ['on a day off', '2026-11-14T07:00:00Z'],
    ['beyond the booking window', '2026-11-24T07:00:00Z'],
  ])('rejects a start time %s', (_, start) => {
    const result = service.create(request({ start: new Date(start) }))
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'SlotUnavailable' }) })
  })

  it('reports an unknown event type', () => {
    expect(service.create(request({ eventTypeId: 'missing' }))).toEqual({
      ok: false,
      error: { kind: 'EventTypeNotFound', eventTypeId: 'missing' },
    })
    expect(service.listSlots('missing').ok).toBe(false)
  })

  it('lists upcoming bookings of all types ordered by start time', () => {
    service.create(request({ eventTypeId: 'code-review', start: new Date('2026-11-10T06:00:00Z') }))
    service.create(request({ start: new Date('2026-11-09T07:00:00Z') }))
    service.create(request({ start: new Date('2026-11-09T06:00:00Z') }))

    now = new Date('2026-11-09T06:45:00Z')
    const upcoming = service.listUpcoming().map((booking) => booking.interval.start.toISOString())

    expect(upcoming).toEqual(['2026-11-09T07:00:00.000Z', '2026-11-10T06:00:00.000Z'])
  })
})
