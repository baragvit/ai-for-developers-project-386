import { beforeEach, describe, expect, it } from 'vitest'
import { EventTypeService } from '../src/services/event-type-service.js'
import { InMemoryEventTypeRepository } from '../src/storage/repositories.js'

const quickSync = { id: 'quick-sync', name: 'Быстрый созвон', description: '', durationMinutes: 15 }

describe('EventTypeService', () => {
  let service: EventTypeService

  beforeEach(() => {
    service = new EventTypeService(new InMemoryEventTypeRepository())
  })

  it('creates an event type and returns it by id and in the list', () => {
    expect(service.create(quickSync)).toEqual({ ok: true, value: quickSync })
    expect(service.get('quick-sync')).toEqual({ ok: true, value: quickSync })
    expect(service.list()).toEqual([quickSync])
  })

  it('refuses an id that is already taken and keeps the existing event type', () => {
    service.create(quickSync)

    const result = service.create({ ...quickSync, name: 'Дубликат' })

    expect(result).toEqual({ ok: false, error: { kind: 'EventTypeAlreadyExists', eventTypeId: 'quick-sync' } })
    expect(service.list()).toEqual([quickSync])
  })

  it('reports an unknown event type', () => {
    expect(service.get('nope')).toEqual({ ok: false, error: { kind: 'EventTypeNotFound', eventTypeId: 'nope' } })
  })
})
