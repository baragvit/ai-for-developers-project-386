import type { FastifyInstance, FastifyReply } from 'fastify'
import type { DomainError, Owner } from '../domain/model.js'
import type { Result } from '../domain/result.js'
import type { BookingService } from '../services/booking-service.js'
import type { EventTypeService } from '../services/event-type-service.js'
import {
  fromCreateBookingRequestDto,
  fromEventTypeDto,
  toBookingDto,
  toErrorResponse,
  toEventTypeDto,
  toOwnerDto,
  toTimeSlotDto,
} from './mappers.js'
import type { BadRequestErrorDto } from './model/index.js'
import { createBookingRequestSchema, eventTypeSchema, parseBody } from './validation.js'

export type ApiDependencies = {
  owner: Owner
  eventTypeService: EventTypeService
  bookingService: BookingService
}

type EventTypeParams = { Params: { eventTypeId: string } }

function reply<T>(
  res: FastifyReply,
  result: Result<T, DomainError>,
  toDto: (value: T) => unknown,
  successStatus = 200,
) {
  if (result.ok) return res.code(successStatus).send(toDto(result.value))
  const { status, body } = toErrorResponse(result.error)
  return res.code(status).send(body)
}

function validationError(res: FastifyReply, details: BadRequestErrorDto['details']) {
  const body: BadRequestErrorDto = {
    code: 'VALIDATION_ERROR',
    message: 'Проверьте правильность заполнения полей',
    details,
  }
  return res.code(400).send(body)
}

export async function apiRoutes(app: FastifyInstance, deps: ApiDependencies) {
  const { owner, eventTypeService, bookingService } = deps

  app.get('/api/owner', async () => toOwnerDto(owner))

  app.get('/api/event-types', async () => eventTypeService.list().map(toEventTypeDto))

  app.get<EventTypeParams>('/api/event-types/:eventTypeId', async (req, res) =>
    reply(res, eventTypeService.get(req.params.eventTypeId), toEventTypeDto),
  )

  app.get<EventTypeParams>('/api/event-types/:eventTypeId/slots', async (req, res) =>
    reply(res, bookingService.listSlots(req.params.eventTypeId), (slots) => slots.map(toTimeSlotDto)),
  )

  app.post('/api/bookings', async (req, res) => {
    const parsed = parseBody(createBookingRequestSchema, req.body)
    if (!parsed.success) return validationError(res, parsed.details)
    return reply(res, bookingService.create(fromCreateBookingRequestDto(parsed.data)), toBookingDto, 201)
  })

  app.post('/api/admin/event-types', async (req, res) => {
    const parsed = parseBody(eventTypeSchema, req.body)
    if (!parsed.success) return validationError(res, parsed.details)
    return reply(res, eventTypeService.create(fromEventTypeDto(parsed.data)), toEventTypeDto, 201)
  })

  app.get('/api/admin/bookings', async () => bookingService.listUpcoming().map(toBookingDto))
}
