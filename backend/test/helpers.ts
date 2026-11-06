import type { FastifyInstance } from 'fastify'
import { expect } from 'vitest'
import type { Config } from '../src/config.js'
import type { Owner } from '../src/domain/model.js'
import { injectChecked } from './contract.js'

export const owner: Owner = {
  name: 'Анна Смирнова',
  timezone: 'Europe/Moscow',
  workdayStart: { hours: 9, minutes: 0 },
  workdayEnd: { hours: 18, minutes: 0 },
  workingDays: new Set([1, 2, 3, 4, 5]),
  bookingWindowDays: 14,
}

/** Monday, 9 November 2026, 08:00 in Moscow (UTC+3). */
export const MONDAY_8AM_MSK = new Date('2026-11-09T05:00:00Z')

export const testConfig: Config = {
  host: '127.0.0.1',
  port: 0,
  owner,
  seedDemoData: true,
  staticDir: '/nonexistent',
}

export const bookingBody = {
  eventTypeId: 'consultation',
  startAt: '2026-11-09T06:00:00Z',
  guestName: 'Иван Петров',
  guestEmail: 'ivan@example.com',
  comment: 'Обсудить архитектуру',
}

export const postBooking = (app: FastifyInstance, payload: Record<string, unknown>) =>
  injectChecked(app, { method: 'POST', url: '/api/bookings', payload })

export const book = (app: FastifyInstance, eventTypeId: string, startAt: string, guestName = bookingBody.guestName) =>
  postBooking(app, { ...bookingBody, eventTypeId, startAt, guestName })

export type SlotDto = { startAt: string; endAt: string; available: boolean }

export async function listSlots(app: FastifyInstance, eventTypeId: string): Promise<SlotDto[]> {
  const res = await injectChecked(app, { method: 'GET', url: `/api/event-types/${eventTypeId}/slots` })
  expect(res.statusCode).toBe(200)
  return res.json()
}
