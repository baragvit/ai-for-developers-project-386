import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createContractChecker, injectChecked } from './contract.js'

describe('injectChecked', () => {
  let app: FastifyInstance
  let eventTypesBody: unknown
  let eventTypesStatus: number

  beforeEach(() => {
    eventTypesBody = [{ id: 'consultation', name: 'Консультация', description: '', durationMinutes: 30 }]
    eventTypesStatus = 200
    app = Fastify()
    app.get('/api/event-types', async (_req, res) => res.code(eventTypesStatus).send(eventTypesBody))
    app.get('/api/event-types/:eventTypeId', async (_req, res) =>
      res.code(404).send({ code: 'NOT_FOUND', message: 'Тип встречи не найден' }),
    )
    app.get('/api/undeclared', async () => ({}))
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns a response that matches the contract', async () => {
    const res = await injectChecked(app, { method: 'GET', url: '/api/event-types' })
    expect(res.statusCode).toBe(200)
  })

  it('matches path templates and error statuses declared for the operation', async () => {
    const res = await injectChecked(app, { method: 'GET', url: '/api/event-types/missing' })
    expect(res.statusCode).toBe(404)
  })

  it('fails when the body breaks the response schema', async () => {
    eventTypesBody = [{ id: 'consultation', name: 'Консультация', durationMinutes: '30' }]
    await expect(injectChecked(app, { method: 'GET', url: '/api/event-types' })).rejects.toThrow(
      /Public_listEventTypes 200/,
    )
  })

  it('fails when the status is not declared for the operation', async () => {
    eventTypesStatus = 418
    await expect(injectChecked(app, { method: 'GET', url: '/api/event-types' })).rejects.toThrow(
      /does not declare status 418/,
    )
  })

  it('fails for a route that is not in the contract', async () => {
    await expect(injectChecked(app, { method: 'GET', url: '/api/undeclared' })).rejects.toThrow(
      /No operation in the contract/,
    )
  })

  it('fails for a status covered only by a default response', async () => {
    const contract = createContractChecker({
      paths: {
        '/api/failing': {
          get: {
            operationId: 'failing',
            responses: {
              '200': {},
              default: { content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
      components: {},
    })
    app.get('/api/failing', async (_req, res) => res.code(500).send({ code: 'INTERNAL' }))

    await expect(contract.injectChecked(app, { method: 'GET', url: '/api/failing' })).rejects.toThrow(
      /failing does not declare status 500/,
    )
  })
})
