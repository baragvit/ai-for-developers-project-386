import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Owner, TimeOfDay } from './domain/model.js'

export type Config = {
  host: string
  port: number
  owner: Owner
  seedDemoData: boolean
  /** Directory with the built frontend; served as an SPA when it exists. */
  staticDir: string
}

const defaultStaticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist')

function parseTimeOfDay(value: string, name: string): TimeOfDay {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) throw new Error(`${name} must be in HH:mm format, got "${value}"`)
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

function parseWorkingDays(value: string): Set<number> {
  const days = value.split(',').map((day) => Number(day.trim()))
  if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error(`WORKING_DAYS must be a comma-separated list of ISO weekdays 1-7, got "${value}"`)
  }
  return new Set(days)
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer, got "${value}"`)
  return parsed
}

function assertTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    throw new Error(`OWNER_TIMEZONE must be a valid IANA time zone, got "${timezone}"`)
  }
  return timezone
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const workdayStart = parseTimeOfDay(env.WORKDAY_START ?? '09:00', 'WORKDAY_START')
  const workdayEnd = parseTimeOfDay(env.WORKDAY_END ?? '18:00', 'WORKDAY_END')
  if (workdayStart.hours * 60 + workdayStart.minutes >= workdayEnd.hours * 60 + workdayEnd.minutes) {
    throw new Error('WORKDAY_START must be earlier than WORKDAY_END')
  }

  return {
    host: env.HOST ?? '0.0.0.0',
    port: parsePositiveInt(env.PORT ?? '7341', 'PORT'),
    seedDemoData: (env.SEED_DEMO_DATA ?? 'true') !== 'false',
    staticDir: env.STATIC_DIR ?? defaultStaticDir,
    owner: {
      name: env.OWNER_NAME ?? 'Анна Смирнова',
      timezone: assertTimeZone(env.OWNER_TIMEZONE ?? 'Europe/Moscow'),
      workdayStart,
      workdayEnd,
      workingDays: parseWorkingDays(env.WORKING_DAYS ?? '1,2,3,4,5'),
      bookingWindowDays: parsePositiveInt(env.BOOKING_WINDOW_DAYS ?? '14', 'BOOKING_WINDOW_DAYS'),
    },
  }
}
