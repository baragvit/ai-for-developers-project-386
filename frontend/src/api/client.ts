import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type Owner = components['schemas']['Owner']
export type EventType = components['schemas']['EventType']
export type TimeSlot = components['schemas']['TimeSlot']
export type Booking = components['schemas']['Booking']
export type CreateBookingRequest = components['schemas']['CreateBookingRequest']
export type FieldError = components['schemas']['FieldError']

const client = createClient<paths>({ baseUrl: window.location.origin })

const messagesByCode: Record<string, string> = {
  NETWORK_ERROR: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.',
  NOT_FOUND: 'Ничего не нашлось — возможно, ссылка устарела.',
  SLOT_TAKEN: 'Это время только что заняли. Выберите другой слот.',
  SLOT_UNAVAILABLE: 'Это время больше недоступно для записи. Выберите другой слот.',
  EVENT_TYPE_ALREADY_EXISTS: 'Тип встречи с таким id уже существует.',
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей.',
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: FieldError[]

  constructor(status: number, code: string, message: string, details: FieldError[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

type ErrorBody = { code?: string; message?: string; details?: FieldError[] }

async function call<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response }
  try {
    result = await request
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', messagesByCode.NETWORK_ERROR)
  }

  const { data, error, response } = result
  if (!response.ok) {
    const body: ErrorBody = typeof error === 'object' && error !== null ? (error as ErrorBody) : {}
    const code = body.code ?? (response.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN')
    const message =
      messagesByCode[code] ?? body.message ?? 'Что-то пошло не так. Попробуйте ещё раз чуть позже.'
    throw new ApiError(response.status, code, message, body.details)
  }
  return data as T
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError(0, 'UNKNOWN', 'Что-то пошло не так. Попробуйте ещё раз чуть позже.')
}

export const bookingApi = {
  getOwner: () => call(client.GET('/api/owner')),

  listEventTypes: () => call(client.GET('/api/event-types')),

  getEventType: (eventTypeId: string) =>
    call(client.GET('/api/event-types/{eventTypeId}', { params: { path: { eventTypeId } } })),

  listSlots: (eventTypeId: string) =>
    call(client.GET('/api/event-types/{eventTypeId}/slots', { params: { path: { eventTypeId } } })),

  createBooking: (body: CreateBookingRequest) => call(client.POST('/api/bookings', { body })),

  createEventType: (body: EventType) => call(client.POST('/api/admin/event-types', { body })),

  listUpcomingBookings: () => call(client.GET('/api/admin/bookings')),
}
