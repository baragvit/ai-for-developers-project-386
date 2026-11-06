import { z } from 'zod'
import type { CreateBookingRequestDto, EventTypeDto, FieldErrorDto } from './model/index.js'

/** Request schemas mirror the constraints declared in api-contract/main.tsp. */
export const eventTypeSchema = z.object({
  id: z
    .string({ error: 'Обязательное поле' })
    .min(2, 'От 2 до 64 символов')
    .max(64, 'От 2 до 64 символов')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Только латиница в нижнем регистре, цифры и дефисы'),
  name: z
    .string({ error: 'Обязательное поле' })
    .trim()
    .min(1, 'Укажите название')
    .max(100, 'Не длиннее 100 символов'),
  description: z.string({ error: 'Обязательное поле' }).trim().max(500, 'Не длиннее 500 символов'),
  durationMinutes: z
    .number({ error: 'Укажите число минут' })
    .int('Целое число минут')
    .min(5, 'От 5 до 240 минут')
    .max(240, 'От 5 до 240 минут'),
}) satisfies z.ZodType<EventTypeDto>

export const createBookingRequestSchema = z.object({
  eventTypeId: z.string({ error: 'Обязательное поле' }).min(1, 'Обязательное поле'),
  startAt: z.iso.datetime({ offset: true, error: 'Дата и время в формате ISO 8601' }),
  guestName: z
    .string({ error: 'Обязательное поле' })
    .trim()
    .min(1, 'Представьтесь, пожалуйста')
    .max(100, 'Не длиннее 100 символов'),
  guestEmail: z
    .string({ error: 'Обязательное поле' })
    .trim()
    .max(254, 'Слишком длинный email')
    .pipe(z.email('Укажите корректный email')),
  comment: z.string().trim().max(1000, 'Не длиннее 1000 символов').optional(),
}) satisfies z.ZodType<CreateBookingRequestDto>

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
