import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { MONDAY_8AM_MSK, testConfig } from './helpers.js'

const bookingBody = {
  eventTypeId: 'consultation',
  startAt: '2026-11-09T06:00:00Z',
  guestName: 'Иван Петров',
  guestEmail: 'ivan@example.com',
  comment: 'Обсудить архитектуру',
}

describe('HTTP API', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp({ config: testConfig, clock: () => MONDAY_8AM_MSK })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns the owner profile', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/owner' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      name: 'Анна Смирнова',
      timezone: 'Europe/Moscow',
      workdayStart: '09:00',
      workdayEnd: '18:00',
      workingDays: [1, 2, 3, 4, 5],
      bookingWindowDays: 14,
    })
  })

  it('lists event types and returns one by id', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/event-types' })
    expect(list.json()).toHaveLength(3)

    const one = await app.inject({ method: 'GET', url: '/api/event-types/code-review' })
    expect(one.json()).toMatchObject({ id: 'code-review', durationMinutes: 45 })

    const missing = await app.inject({ method: 'GET', url: '/api/event-types/nope' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('creates an event type and rejects duplicates and invalid input', async () => {
    const payload = { id: 'quick-sync', name: 'Быстрый созвон', description: '', durationMinutes: 15 }

    const created = await app.inject({ method: 'POST', url: '/api/admin/event-types', payload })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toEqual(payload)

    const duplicate = await app.inject({ method: 'POST', url: '/api/admin/event-types', payload })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json()).toMatchObject({ code: 'EVENT_TYPE_ALREADY_EXISTS' })

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: { id: 'Bad Id', name: '', description: '', durationMinutes: 1000 },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().code).toBe('VALIDATION_ERROR')
    expect(invalid.json().details.map((d: { field: string }) => d.field).sort()).toEqual([
      'durationMinutes',
      'id',
      'name',
    ])
  })

  it('returns slots for an event type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/event-types/consultation/slots' })
    expect(res.statusCode).toBe(200)
    expect(res.json()[0]).toEqual({
      startAt: '2026-11-09T06:00:00.000Z',
      endAt: '2026-11-09T06:30:00.000Z',
      available: true,
    })
  })

  it('books a slot, refuses to double-book it and shows it to the owner', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/bookings', payload: bookingBody })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      eventTypeId: 'consultation',
      eventTypeName: 'Консультация',
      startAt: '2026-11-09T06:00:00.000Z',
      endAt: '2026-11-09T06:30:00.000Z',
      guestName: 'Иван Петров',
      comment: 'Обсудить архитектуру',
    })

    const overlapping = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, eventTypeId: 'tech-interview' },
    })
    expect(overlapping.statusCode).toBe(409)
    expect(overlapping.json()).toMatchObject({ code: 'SLOT_TAKEN' })

    const upcoming = await app.inject({ method: 'GET', url: '/api/admin/bookings' })
    expect(upcoming.json()).toHaveLength(1)
    expect(upcoming.json()[0].id).toBe(created.json().id)
  })

  it('validates booking requests', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, guestEmail: 'not-an-email', guestName: '  ' },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().details.map((d: { field: string }) => d.field).sort()).toEqual(['guestEmail', 'guestName'])

    const misaligned = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, startAt: '2026-11-09T06:05:00Z' },
    })
    expect(misaligned.statusCode).toBe(400)
    expect(misaligned.json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })

    const unknownType = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, eventTypeId: 'missing' },
    })
    expect(unknownType.statusCode).toBe(404)
  })

  it('answers malformed JSON and unknown API routes with JSON errors', async () => {
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { 'content-type': 'application/json' },
      payload: '{"oops"',
    })
    expect(malformed.statusCode).toBe(400)
    expect(malformed.json()).toMatchObject({ code: 'VALIDATION_ERROR' })

    const unknown = await app.inject({ method: 'GET', url: '/api/unknown' })
    expect(unknown.statusCode).toBe(404)
    expect(unknown.json()).toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('frontend hosting', () => {
  let app: FastifyInstance
  let staticDir: string

  beforeEach(async () => {
    staticDir = mkdtempSync(path.join(tmpdir(), 'spa-'))
    writeFileSync(path.join(staticDir, 'index.html'), '<div id="root"></div>')
    app = await buildApp({ config: { ...testConfig, staticDir }, clock: () => MONDAY_8AM_MSK })
  })

  afterEach(async () => {
    await app.close()
    rmSync(staticDir, { recursive: true, force: true })
  })

  it('serves index.html for client-side routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/book/consultation', headers: { accept: 'text/html' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="root">')
  })

  it('does not answer missing assets with the HTML page', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/missing.js', headers: { accept: '*/*' } })
    expect(res.statusCode).toBe(404)
  })
})
