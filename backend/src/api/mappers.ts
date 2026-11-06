import type { Booking, DomainError, EventType, NewBooking, Owner, Slot, TimeOfDay } from '../domain/model.js'
import type {
  BadRequestErrorDto,
  BookingDto,
  ConflictErrorDto,
  CreateBookingRequestDto,
  EventTypeDto,
  NotFoundErrorDto,
  OwnerDto,
  TimeSlotDto,
} from './model/index.js'

const formatTimeOfDay = ({ hours, minutes }: TimeOfDay): string =>
  `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

export const toOwnerDto = (owner: Owner): OwnerDto => ({
  name: owner.name,
  timezone: owner.timezone,
  workdayStart: formatTimeOfDay(owner.workdayStart),
  workdayEnd: formatTimeOfDay(owner.workdayEnd),
  workingDays: [...owner.workingDays].sort((a, b) => a - b),
  bookingWindowDays: owner.bookingWindowDays,
})

export const toEventTypeDto = (eventType: EventType): EventTypeDto => ({
  id: eventType.id,
  name: eventType.name,
  description: eventType.description,
  durationMinutes: eventType.durationMinutes,
})

export const fromEventTypeDto = (dto: EventTypeDto): EventType => ({
  id: dto.id,
  name: dto.name,
  description: dto.description,
  durationMinutes: dto.durationMinutes,
})

export const toTimeSlotDto = (slot: Slot): TimeSlotDto => ({
  startAt: slot.interval.start.toISOString(),
  endAt: slot.interval.end.toISOString(),
  available: slot.available,
})

export const fromCreateBookingRequestDto = (dto: CreateBookingRequestDto): NewBooking => ({
  eventTypeId: dto.eventTypeId,
  start: new Date(dto.startAt),
  guestName: dto.guestName,
  guestEmail: dto.guestEmail,
  comment: dto.comment || undefined,
})

export const toBookingDto = (booking: Booking): BookingDto => ({
  id: booking.id,
  eventTypeId: booking.eventTypeId,
  eventTypeName: booking.eventTypeName,
  startAt: booking.interval.start.toISOString(),
  endAt: booking.interval.end.toISOString(),
  guestName: booking.guestName,
  guestEmail: booking.guestEmail,
  ...(booking.comment ? { comment: booking.comment } : {}),
  createdAt: booking.createdAt.toISOString(),
})

type ErrorResponse =
  | { status: 400; body: BadRequestErrorDto }
  | { status: 404; body: NotFoundErrorDto }
  | { status: 409; body: ConflictErrorDto }

export function toErrorResponse(error: DomainError): ErrorResponse {
  switch (error.kind) {
    case 'EventTypeNotFound':
      return {
        status: 404,
        body: { code: 'NOT_FOUND', message: `Тип встречи «${error.eventTypeId}» не найден` },
      }
    case 'EventTypeAlreadyExists':
      return {
        status: 409,
        body: {
          code: 'EVENT_TYPE_ALREADY_EXISTS',
          message: `Тип встречи с id «${error.eventTypeId}» уже существует`,
        },
      }
    case 'SlotUnavailable':
      return {
        status: 400,
        body: { code: 'SLOT_UNAVAILABLE', message: 'Это время недоступно для записи' },
      }
    case 'SlotTaken':
      return {
        status: 409,
        body: { code: 'SLOT_TAKEN', message: 'Это время уже занято другой записью' },
      }
  }
}
