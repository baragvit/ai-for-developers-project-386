import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { injectChecked } from './contract.js'
import { MONDAY_8AM_MSK, testConfig } from './helpers.js'

// Seeded event types: consultation — 30 min, code-review — 45 min, tech-interview — 60 min.
// Times are Monday 9 November 2026; Moscow is UTC+3, so 10:00 MSK is 07:00Z.
describe('booking conflicts', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp({ config: testConfig, clock: () => MONDAY_8AM_MSK })
  })

  afterEach(async () => {
    await app.close()
  })

  const book = (eventTypeId: string, startAt: string, guestName = 'Иван Петров') =>
    injectChecked(app, {
      method: 'POST',
      url: '/api/bookings',
      payload: { eventTypeId, startAt, guestName, guestEmail: 'ivan@example.com' },
    })

  const availability = async (eventTypeId: string, day = '2026-11-09') => {
    const res = await injectChecked(app, { method: 'GET', url: `/api/event-types/${eventTypeId}/slots` })
    expect(res.statusCode).toBe(200)
    return Object.fromEntries(
      (res.json() as { startAt: string; available: boolean }[])
        .filter((slot) => slot.startAt.startsWith(day))
        .map((slot) => [slot.startAt.slice(11, 16), slot.available]),
    )
  }

  it('rejects a shorter booking of another event type inside an existing one with 409 SLOT_TAKEN', async () => {
    expect((await book('tech-interview', '2026-11-09T07:00:00Z')).statusCode).toBe(201)

    const res = await book('consultation', '2026-11-09T07:30:00Z')

    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ code: 'SLOT_TAKEN', message: expect.any(String) })
  })

  it('accepts a booking that starts exactly when another one ends', async () => {
    expect((await book('tech-interview', '2026-11-09T07:00:00Z')).statusCode).toBe(201)

    const adjacent = await book('consultation', '2026-11-09T08:00:00Z')

    expect(adjacent.statusCode).toBe(201)
    expect(adjacent.json()).toMatchObject({ startAt: '2026-11-09T08:00:00.000Z', endAt: '2026-11-09T08:30:00.000Z' })
  })

  it('accepts a booking that ends exactly when another one starts', async () => {
    expect((await book('tech-interview', '2026-11-09T07:00:00Z')).statusCode).toBe(201)

    expect((await book('consultation', '2026-11-09T06:30:00Z')).statusCode).toBe(201)
  })

  it.each([
    ['a longer booking covering it', 'consultation', '2026-11-09T07:30:00Z', 'tech-interview', '2026-11-09T07:00:00Z'],
    ['a booking overlapping its end', 'code-review', '2026-11-09T06:00:00Z', 'consultation', '2026-11-09T06:30:00Z'],
    ['a booking overlapping its start', 'consultation', '2026-11-09T07:00:00Z', 'code-review', '2026-11-09T06:45:00Z'],
    ['a booking of the same time', 'code-review', '2026-11-09T06:45:00Z', 'code-review', '2026-11-09T06:45:00Z'],
  ])('rejects %s', async (_, existingType, existingStart, eventTypeId, startAt) => {
    expect((await book(existingType, existingStart)).statusCode).toBe(201)

    const res = await book(eventTypeId, startAt)

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 'SLOT_TAKEN' })
  })

  it('marks slots of other event types overlapping a booking as unavailable', async () => {
    expect((await book('tech-interview', '2026-11-09T07:00:00Z')).statusCode).toBe(201)

    expect(await availability('consultation')).toMatchObject({
      '06:30': true,
      '07:00': false,
      '07:30': false,
      '08:00': true,
    })
    // The 45-minute grid: 09:00, 09:45, 10:30, 11:15 in Moscow.
    expect(await availability('code-review')).toMatchObject({
      '06:00': true,
      '06:45': false,
      '07:30': false,
      '08:15': true,
    })
    expect(await availability('tech-interview')).toMatchObject({ '06:00': true, '07:00': false, '08:00': true })
  })

  it('lets exactly one of simultaneous overlapping requests win, even for different event types', async () => {
    const attempts: [string, string][] = [
      ['tech-interview', '2026-11-09T07:00:00Z'],
      ['consultation', '2026-11-09T07:30:00Z'],
      ['code-review', '2026-11-09T07:30:00Z'],
      ['tech-interview', '2026-11-09T07:00:00Z'],
      ['consultation', '2026-11-09T07:00:00Z'],
      ['code-review', '2026-11-09T06:45:00Z'],
    ]

    const responses = await Promise.all(
      attempts.map(([eventTypeId, startAt], index) => book(eventTypeId, startAt, `Гость ${index}`)),
    )

    const statuses = responses.map((res) => res.statusCode)
    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(attempts.length - 1)
    for (const res of responses.filter((candidate) => candidate.statusCode === 409)) {
      expect(res.json()).toMatchObject({ code: 'SLOT_TAKEN' })
    }

    const upcoming = await injectChecked(app, { method: 'GET', url: '/api/admin/bookings' })
    expect(upcoming.json()).toHaveLength(1)
  })

  it('lets every simultaneous request through when none of them overlap', async () => {
    const responses = await Promise.all([
      book('tech-interview', '2026-11-09T07:00:00Z'),
      book('consultation', '2026-11-09T06:30:00Z'),
      book('code-review', '2026-11-09T08:15:00Z'),
    ])

    expect(responses.map((res) => res.statusCode)).toEqual([201, 201, 201])
  })
})
