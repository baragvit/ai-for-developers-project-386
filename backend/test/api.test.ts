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

  describe('POST /api/bookings', () => {
    const book = (payload: Record<string, unknown>) => inject({ method: 'POST', url: '/api/bookings', payload })

    it('creates a booking ending after the event type duration with a snapshot of its name', async () => {
      const res = await book({ ...bookingBody, eventTypeId: 'code-review', startAt: '2026-11-09T06:45:00+00:00' })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        eventTypeId: 'code-review',
        eventTypeName: 'Ревью кода',
        startAt: '2026-11-09T06:45:00.000Z',
        endAt: '2026-11-09T07:30:00.000Z',
        guestName: 'Иван Петров',
        guestEmail: 'ivan@example.com',
        comment: 'Обсудить архитектуру',
        createdAt: '2026-11-09T05:00:00.000Z',
      })
    })

    it('trims guest fields and treats a blank comment as absent', async () => {
      const res = await book({
        ...bookingBody,
        guestName: '  Иван  ',
        guestEmail: ' ivan@example.com ',
        comment: '   ',
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ guestName: 'Иван', guestEmail: 'ivan@example.com' })
      expect(res.json()).not.toHaveProperty('comment')
    })

    it.each([
      ['guestName is missing', { guestName: undefined }, 'guestName', 'Обязательное поле'],
      ['guestName is blank', { guestName: '   ' }, 'guestName', 'Заполните поле'],
      ['guestName is too long', { guestName: 'я'.repeat(101) }, 'guestName', 'Не длиннее 100 символов'],
      ['guestEmail is missing', { guestEmail: undefined }, 'guestEmail', 'Обязательное поле'],
      ['guestEmail is not an email', { guestEmail: 'ivan@' }, 'guestEmail', 'Укажите корректный email'],
      [
        'guestEmail is too long',
        { guestEmail: `${'a'.repeat(64)}@${'b'.repeat(186)}.com` },
        'guestEmail',
        'Не длиннее 254 символов',
      ],
      ['comment is too long', { comment: 'я'.repeat(1001) }, 'comment', 'Не длиннее 1000 символов'],
      ['eventTypeId is missing', { eventTypeId: undefined }, 'eventTypeId', 'Обязательное поле'],
      ['startAt is not ISO 8601', { startAt: '9 ноября 9:00' }, 'startAt', 'Дата и время в формате ISO 8601'],
    ])('answers 400 VALIDATION_ERROR when %s', async (_, override, field, message) => {
      const res = await book({ ...bookingBody, ...override })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Проверьте правильность заполнения полей',
        details: [{ field, message }],
      })
    })

    it('reports every invalid field at once', async () => {
      const res = await book({ ...bookingBody, guestEmail: 'not-an-email', guestName: '  ' })

      expect(res.statusCode).toBe(400)
      expect(res.json().details).toEqual([
        { field: 'guestName', message: 'Заполните поле' },
        { field: 'guestEmail', message: 'Укажите корректный email' },
      ])
    })

    it('answers 404 NOT_FOUND for an unknown event type', async () => {
      const res = await book({ ...bookingBody, eventTypeId: 'missing' })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Тип встречи «missing» не найден' })
    })

    it.each([
      ['in the past', '2026-11-06T06:00:00Z'],
      ['before the workday starts', '2026-11-09T05:30:00Z'],
      ['ending after the workday', '2026-11-09T14:45:00Z'],
      ['at the end of the workday', '2026-11-09T15:00:00Z'],
      ['on a day off', '2026-11-14T06:00:00Z'],
      ['after the 14-day window', '2026-11-23T06:00:00Z'],
      ['off the slot grid', '2026-11-09T06:05:00Z'],
      ['between two 45-minute slots', '2026-11-09T06:30:00Z', 'code-review'],
    ])('answers 400 SLOT_UNAVAILABLE for a start %s', async (_, startAt, eventTypeId = 'consultation') => {
      const res = await book({ ...bookingBody, eventTypeId, startAt })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ code: 'SLOT_UNAVAILABLE', message: 'Это время недоступно для записи' })
    })

    it('answers 400 SLOT_UNAVAILABLE for a slot that has already started', async () => {
      await app.close()
      app = await buildApp({ config: testConfig, clock: () => new Date('2026-11-09T09:10:00Z') })

      const started = await book({ ...bookingBody, startAt: '2026-11-09T09:00:00Z' })
      const next = await book({ ...bookingBody, startAt: '2026-11-09T09:30:00Z' })

      expect(started.statusCode).toBe(400)
      expect(started.json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })
      expect(next.statusCode).toBe(201)
    })

    it('checks fields first, then the event type, then the time', async () => {
      const invalidFieldsOfUnknownType = await book({
        ...bookingBody,
        eventTypeId: 'missing',
        startAt: '2026-11-14T06:00:00Z',
        guestEmail: 'not-an-email',
      })
      expect(invalidFieldsOfUnknownType.statusCode).toBe(400)
      expect(invalidFieldsOfUnknownType.json()).toMatchObject({ code: 'VALIDATION_ERROR' })

      const unknownTypeAtWrongTime = await book({
        ...bookingBody,
        eventTypeId: 'missing',
        startAt: '2026-11-14T06:00:00Z',
      })
      expect(unknownTypeAtWrongTime.statusCode).toBe(404)
      expect(unknownTypeAtWrongTime.json()).toMatchObject({ code: 'NOT_FOUND' })

      expect((await book(bookingBody)).statusCode).toBe(201)
      const offGridOverBooking = await book({ ...bookingBody, startAt: '2026-11-09T06:05:00Z' })
      expect(offGridOverBooking.statusCode).toBe(400)
      expect(offGridOverBooking.json()).toMatchObject({ code: 'SLOT_UNAVAILABLE' })
    })
  })

  describe('GET /api/admin/bookings', () => {
    let now: Date

    beforeEach(async () => {
      await app.close()
      now = MONDAY_8AM_MSK
      app = await buildApp({ config: testConfig, clock: () => now })
    })

    const book = async (eventTypeId: string, startAt: string, guestName: string) => {
      const res = await inject({
        method: 'POST',
        url: '/api/bookings',
        payload: { ...bookingBody, eventTypeId, startAt, guestName },
      })
      expect(res.statusCode).toBe(201)
    }

    const listUpcoming = async () => {
      const res = await inject({ method: 'GET', url: '/api/admin/bookings' })
      expect(res.statusCode).toBe(200)
      return res.json() as { guestName: string; eventTypeName: string; startAt: string }[]
    }

    it('is empty when nobody has booked', async () => {
      expect(await listUpcoming()).toEqual([])
    })

    it('lists bookings of every event type in one list sorted by start time', async () => {
      await book('tech-interview', '2026-11-10T07:00:00Z', 'Вторник')
      await book('consultation', '2026-11-09T08:00:00Z', 'Понедельник, 11:00')
      await book('code-review', '2026-11-09T06:00:00Z', 'Понедельник, 09:00')

      expect((await listUpcoming()).map(({ guestName, eventTypeName }) => [guestName, eventTypeName])).toEqual([
        ['Понедельник, 09:00', 'Ревью кода'],
        ['Понедельник, 11:00', 'Консультация'],
        ['Вторник', 'Техническое интервью'],
      ])
    })

    it('keeps a meeting until it ends and drops it afterwards', async () => {
      await book('tech-interview', '2026-11-09T06:00:00Z', 'Идёт сейчас')
      await book('consultation', '2026-11-09T08:00:00Z', 'Позже')

      now = new Date('2026-11-09T06:59:59Z')
      expect((await listUpcoming()).map((booking) => booking.guestName)).toEqual(['Идёт сейчас', 'Позже'])

      now = new Date('2026-11-09T07:00:00Z')
      expect((await listUpcoming()).map((booking) => booking.guestName)).toEqual(['Позже'])
    })
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
