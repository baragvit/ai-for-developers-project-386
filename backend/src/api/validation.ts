import { z } from 'zod'
import type { CreateBookingRequestDto, EventTypeDto, FieldErrorDto } from './model/index.js'
import { zAdminCreateEventTypeBody, zPublicCreateBookingBody } from './model/zod/zod.gen.js'

/** Patterns from the contract have no readable meaning on their own, so their message is set per field. */
const patternMessages: Record<string, string> = {
  id: 'Только латиница в нижнем регистре, цифры и дефисы',
}

function russianMessage(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined) return 'Обязательное поле'
      if (issue.expected === 'int' || issue.expected === 'number') return 'Укажите целое число'
      return 'Неверный тип значения'
    case 'too_small':
      if (issue.origin === 'string') {
        return Number(issue.minimum) <= 1 ? 'Заполните поле' : `Не короче ${issue.minimum} символов`
      }
      return `Не меньше ${issue.minimum}`
    case 'too_big':
      if (issue.origin === 'string') return `Не длиннее ${issue.maximum} символов`
      return `Не больше ${issue.maximum}`
    case 'invalid_format':
      if (issue.format === 'email') return 'Укажите корректный email'
      if (issue.format === 'datetime') return 'Дата и время в формате ISO 8601'
      return patternMessages[String(issue.path?.[0])] ?? 'Неверный формат'
    case 'not_multiple_of':
      return `Должно быть кратно ${issue.divisor}`
    default:
      return 'Некорректное значение'
  }
}

z.config({ customError: russianMessage })

function trimStrings(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  )
}

/** The zod generator drops the contract's `multipleOf`, so the duration step is restated here. */
const DURATION_STEP_MINUTES = 5

/** Request schemas are generated from the contract; this layer trims text fields and restores dropped rules. */
export const eventTypeSchema = z.preprocess(
  trimStrings,
  zAdminCreateEventTypeBody.extend({
    durationMinutes: zAdminCreateEventTypeBody.shape.durationMinutes.multipleOf(DURATION_STEP_MINUTES),
  }),
) satisfies z.ZodType<EventTypeDto>

export const createBookingRequestSchema = z.preprocess(
  trimStrings,
  zPublicCreateBookingBody,
) satisfies z.ZodType<CreateBookingRequestDto>

export type ParseResult<T> = { success: true; data: T } | { success: false; details: FieldErrorDto[] }

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    details: result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    })),
  }
}
