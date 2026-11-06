import { overlaps, type Booking, type EventType, type Interval } from '../domain/model.js'

export interface EventTypeRepository {
  list(): EventType[]
  findById(id: string): EventType | undefined
  insert(eventType: EventType): void
}

export interface BookingRepository {
  listEndingAfter(moment: Date): Booking[]
  findOverlapping(interval: Interval): Booking[]
  insert(booking: Booking): void
}

export class InMemoryEventTypeRepository implements EventTypeRepository {
  private readonly items = new Map<string, EventType>()

  list(): EventType[] {
    return [...this.items.values()]
  }

  findById(id: string): EventType | undefined {
    return this.items.get(id)
  }

  insert(eventType: EventType): void {
    this.items.set(eventType.id, eventType)
  }
}

export class InMemoryBookingRepository implements BookingRepository {
  private readonly items: Booking[] = []

  listEndingAfter(moment: Date): Booking[] {
    return this.items
      .filter((booking) => booking.interval.end > moment)
      .sort((a, b) => a.interval.start.getTime() - b.interval.start.getTime())
  }

  findOverlapping(interval: Interval): Booking[] {
    return this.items.filter((booking) => overlaps(booking.interval, interval))
  }

  insert(booking: Booking): void {
    this.items.push(booking)
  }
}
