import type { Config } from '../src/config.js'
import type { Owner } from '../src/domain/model.js'

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
