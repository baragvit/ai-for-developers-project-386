import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { injectChecked } from './contract.js'
import { MONDAY_8AM_MSK, testConfig } from './helpers.js'

const bookingBody = {
  eventTypeId: 'consultation',
  startAt: '2026-11-09T06:00:00Z',
  guestName: 'Иван Петров',
  guestEmail: 'ivan@example.com',
  comment: 'Обсудить архитектуру',
}

describe('GET /api/owner', () => {
  const getOwner = async (env: NodeJS.ProcessEnv) => {
    const app = await buildApp({ config: loadConfig(env), clock: () => MONDAY_8AM_MSK })
    try {
      return await injectChecked(app, { method: 'GET', url: '/api/owner' })
    } finally {
      await app.close()
    }
  }

  it('returns the default owner profile when no env is set', async () => {
    const res = await getOwner({})
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

  it('takes the owner profile from env', async () => {
    const res = await getOwner({
      OWNER_NAME: 'Пётр Иванов',
      OWNER_TIMEZONE: 'Asia/Tokyo',
      WORKDAY_START: '10:30',
      WORKDAY_END: '19:00',
      WORKING_DAYS: '7, 6,1',
      BOOKING_WINDOW_DAYS: '7',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      name: 'Пётр Иванов',
      timezone: 'Asia/Tokyo',
      workdayStart: '10:30',
      workdayEnd: '19:00',
      workingDays: [1, 6, 7],
      bookingWindowDays: 7,
    })
  })
})

describe('HTTP API', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp({ config: testConfig, clock: () => MONDAY_8AM_MSK })
  })

  afterEach(async () => {
    await app.close()
  })

  const inject = (options: Parameters<typeof injectChecked>[1]) => injectChecked(app, options)

  it('lists event types and returns one by id', async () => {
    const list = await inject({ method: 'GET', url: '/api/event-types' })
    expect(list.statusCode).toBe(200)
    expect(list.json().map((eventType: { id: string }) => eventType.id)).toEqual([
      'consultation',
      'code-review',
      'tech-interview',
    ])
    expect(list.json()[0]).toEqual({
      id: 'consultation',
      name: 'Консультация',
      description: 'Обсудим ваш проект, задачи и ответим на вопросы.',
      durationMinutes: 30,
    })

    const one = await inject({ method: 'GET', url: '/api/event-types/code-review' })
    expect(one.json()).toMatchObject({ id: 'code-review', durationMinutes: 45 })

    const missing = await inject({ method: 'GET', url: '/api/event-types/nope' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('creates an event type and rejects duplicates and invalid input', async () => {
    const payload = { id: 'quick-sync', name: 'Быстрый созвон', description: '', durationMinutes: 15 }

    const created = await inject({ method: 'POST', url: '/api/admin/event-types', payload })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toEqual(payload)

    const duplicate = await inject({ method: 'POST', url: '/api/admin/event-types', payload })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json()).toMatchObject({ code: 'EVENT_TYPE_ALREADY_EXISTS' })

    const invalid = await inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: { id: 'Bad Id', name: '', description: '', durationMinutes: 1000 },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().code).toBe('VALIDATION_ERROR')
    expect(invalid.json().details).toEqual(
      expect.arrayContaining([
        { field: 'id', message: 'Только латиница в нижнем регистре, цифры и дефисы' },
        { field: 'name', message: 'Заполните поле' },
        { field: 'durationMinutes', message: 'Не больше 240' },
      ]),
    )
    expect(invalid.json().details).toHaveLength(3)
  })

  it('trims text fields of a new event type and requires every contract field', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: { id: 'trimmed', name: '  Созвон  ', description: ' Коротко ', durationMinutes: 15 },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ name: 'Созвон', description: 'Коротко' })

    const incomplete = await inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: { id: 'incomplete', name: 'Созвон', durationMinutes: 'долго' },
    })
    expect(incomplete.statusCode).toBe(400)
    expect(incomplete.json().details).toEqual([
      { field: 'description', message: 'Обязательное поле' },
      { field: 'durationMinutes', message: 'Укажите целое число' },
    ])
  })

  describe('slots', () => {
    type SlotDto = { startAt: string; endAt: string; available: boolean }
    const listSlots = async (eventTypeId: string) => {
      const res = await inject({ method: 'GET', url: `/api/event-types/${eventTypeId}/slots` })
      expect(res.statusCode).toBe(200)
      return res.json() as SlotDto[]
    }

    it('returns the whole window of slots sized by the event type, sorted by time', async () => {
      const slots = await listSlots('consultation')

      // Monday 9 – Friday 20 November: 10 working days, 18 half-hour slots each.
      expect(slots).toHaveLength(180)
      expect(slots[0]).toEqual({
        startAt: '2026-11-09T06:00:00.000Z',
        endAt: '2026-11-09T06:30:00.000Z',
        available: true,
      })
      expect(slots.at(-1)).toEqual({
        startAt: '2026-11-20T14:30:00.000Z',
        endAt: '2026-11-20T15:00:00.000Z',
        available: true,
      })
      const starts = slots.map((slot) => slot.startAt)
      expect(starts).toEqual([...starts].sort())
      expect(slots.some((slot) => slot.startAt.startsWith('2026-11-14'))).toBe(false)
    })

    it('ends the 45-minute grid of a workday at 17:15', async () => {
      const monday = (await listSlots('code-review')).filter((slot) => slot.startAt.startsWith('2026-11-09'))

      expect(monday).toHaveLength(12)
      expect(monday.at(-1)).toEqual({
        startAt: '2026-11-09T14:15:00.000Z',
        endAt: '2026-11-09T15:00:00.000Z',
        available: true,
      })
    })

    it('leaves out slots that have already started', async () => {
      await app.close()
      app = await buildApp({ config: testConfig, clock: () => new Date('2026-11-09T09:10:00Z') })

      const slots = await listSlots('consultation')

      expect(slots[0]!.startAt).toBe('2026-11-09T09:30:00.000Z')
    })

    it('marks slots overlapping a booking of any event type as unavailable', async () => {
      const booked = await inject({
        method: 'POST',
        url: '/api/bookings',
        payload: { ...bookingBody, eventTypeId: 'tech-interview' },
      })
      expect(booked.statusCode).toBe(201)

      const slots = await listSlots('consultation')

      expect(slots).toHaveLength(180)
      expect(slots.slice(0, 3)).toEqual([
        { startAt: '2026-11-09T06:00:00.000Z', endAt: '2026-11-09T06:30:00.000Z', available: false },
        { startAt: '2026-11-09T06:30:00.000Z', endAt: '2026-11-09T07:00:00.000Z', available: false },
        { startAt: '2026-11-09T07:00:00.000Z', endAt: '2026-11-09T07:30:00.000Z', available: true },
      ])
    })

    it('answers 404 for an unknown event type', async () => {
      const res = await inject({ method: 'GET', url: '/api/event-types/nope/slots' })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  it('books a slot, refuses to double-book it and shows it to the owner', async () => {
    const created = await inject({ method: 'POST', url: '/api/bookings', payload: bookingBody })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      eventTypeId: 'consultation',
      eventTypeName: 'Консультация',
      startAt: '2026-11-09T06:00:00.000Z',
      endAt: '2026-11-09T06:30:00.000Z',
      guestName: 'Иван Петров',
      comment: 'Обсудить архитектуру',
    })

    const overlapping = await inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, eventTypeId: 'tech-interview' },
    })
    expect(overlapping.statusCode).toBe(409)
    expect(overlapping.json()).toMatchObject({ code: 'SLOT_TAKEN' })

    const upcoming = await inject({ method: 'GET', url: '/api/admin/bookings' })
    expect(upcoming.json()).toHaveLength(1)
    expect(upcoming.json()[0].id).toBe(created.json().id)
  })

  it('validates booking requests', async () => {
    const invalid = await inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, guestEmail: 'not-an-email', guestName: '  ' },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().details).toEqual([
      { field: 'guestName', message: 'Заполните поле' },
      { field: 'guestEmail', message: 'Укажите корректный email' },
    ])

    const misaligned = await inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, startAt: '2026-11-09T06:05:00Z' },
    })
    expect(misaligned.statusCode).toBe(400)
    expect(misaligned.json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })

    const unknownType = await inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { ...bookingBody, eventTypeId: 'missing' },
    })
    expect(unknownType.statusCode).toBe(404)
  })

  it('answers malformed JSON and unknown API routes with JSON errors', async () => {
    const malformed = await inject({
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
