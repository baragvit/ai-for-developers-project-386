import { randomUUID } from 'node:crypto'
import type { Booking, DomainError, NewBooking, Owner, Slot } from '../domain/model.js'
import { err, ok, type Result } from '../domain/result.js'
import { generateSlotIntervals } from '../domain/schedule.js'
import type { BookingRepository, EventTypeRepository } from '../storage/repositories.js'

export type Clock = () => Date

export class BookingService {
  constructor(
    private readonly owner: Owner,
    private readonly eventTypes: EventTypeRepository,
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
  ) {}

  listSlots(eventTypeId: string): Result<Slot[], DomainError> {
    const eventType = this.eventTypes.findById(eventTypeId)
    if (!eventType) return err({ kind: 'EventTypeNotFound', eventTypeId })

    const slots = generateSlotIntervals(this.owner, eventType.durationMinutes, this.clock()).map(
      (interval) => ({
        interval,
        available: this.bookings.findOverlapping(interval).length === 0,
      }),
    )
    return ok(slots)
  }

  /**
   * Check-and-insert runs synchronously, so on a single Node.js process two concurrent requests
   * cannot both pass the overlap check for the same time.
   */
  create(request: NewBooking): Result<Booking, DomainError> {
    const eventType = this.eventTypes.findById(request.eventTypeId)
    if (!eventType) return err({ kind: 'EventTypeNotFound', eventTypeId: request.eventTypeId })

    const now = this.clock()
    const interval = generateSlotIntervals(this.owner, eventType.durationMinutes, now).find(
      (candidate) => candidate.start.getTime() === request.start.getTime(),
    )
    if (!interval) return err({ kind: 'SlotUnavailable', start: request.start })

    if (this.bookings.findOverlapping(interval).length > 0) {
      return err({ kind: 'SlotTaken', start: request.start })
    }

    const booking: Booking = {
      id: randomUUID(),
      eventTypeId: eventType.id,
      eventTypeName: eventType.name,
      interval,
      guestName: request.guestName,
      guestEmail: request.guestEmail,
      comment: request.comment,
      createdAt: now,
    }
    this.bookings.insert(booking)
    return ok(booking)
  }

  listUpcoming(): Booking[] {
    return this.bookings.listEndingAfter(this.clock())
  }
}
