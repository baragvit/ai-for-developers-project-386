import type { DomainError, EventType } from '../domain/model.js'
import { err, ok, type Result } from '../domain/result.js'
import type { EventTypeRepository } from '../storage/repositories.js'

export class EventTypeService {
  constructor(private readonly eventTypes: EventTypeRepository) {}

  list(): EventType[] {
    return this.eventTypes.list()
  }

  get(id: string): Result<EventType, DomainError> {
    const eventType = this.eventTypes.findById(id)
    return eventType ? ok(eventType) : err({ kind: 'EventTypeNotFound', eventTypeId: id })
  }

  create(eventType: EventType): Result<EventType, DomainError> {
    if (this.eventTypes.findById(eventType.id)) {
      return err({ kind: 'EventTypeAlreadyExists', eventTypeId: eventType.id })
    }
    this.eventTypes.insert(eventType)
    return ok(eventType)
  }
}
