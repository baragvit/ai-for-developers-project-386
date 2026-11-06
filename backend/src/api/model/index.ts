import type { components } from './schema.js'

type Schemas = components['schemas']

export type OwnerDto = Schemas['Owner']
export type EventTypeDto = Schemas['EventType']
export type TimeSlotDto = Schemas['TimeSlot']
export type CreateBookingRequestDto = Schemas['CreateBookingRequest']
export type BookingDto = Schemas['Booking']
export type FieldErrorDto = Schemas['FieldError']
export type BadRequestErrorDto = Schemas['BadRequestError']
export type NotFoundErrorDto = Schemas['NotFoundError']
export type ConflictErrorDto = Schemas['ConflictError']
