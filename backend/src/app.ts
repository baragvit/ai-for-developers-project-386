import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyServerOptions } from 'fastify'
import { apiRoutes } from './api/routes.js'
import type { Config } from './config.js'
import { BookingService, type Clock } from './services/booking-service.js'
import { EventTypeService } from './services/event-type-service.js'
import { seedDemoEventTypes } from './seed.js'
import { InMemoryBookingRepository, InMemoryEventTypeRepository } from './storage/repositories.js'

export type AppOptions = {
  config: Config
  clock?: Clock
  logger?: FastifyServerOptions['logger']
}

export async function buildApp({ config, clock = () => new Date(), logger = false }: AppOptions) {
  const app = Fastify({ logger })

  const eventTypes = new InMemoryEventTypeRepository()
  const bookings = new InMemoryBookingRepository()
  if (config.seedDemoData) seedDemoEventTypes(eventTypes)

  const eventTypeService = new EventTypeService(eventTypes)
  const bookingService = new BookingService(config.owner, eventTypes, bookings, clock)

  app.setErrorHandler((error: { statusCode?: number; message: string }, req, res) => {
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return res.code(400).send({ code: 'VALIDATION_ERROR', message: 'Некорректный запрос' })
    }
    req.log.error(error)
    return res.code(500).send({ code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' })
  })

  await app.register(apiRoutes, { owner: config.owner, eventTypeService, bookingService })

  const serveFrontend = existsSync(config.staticDir)
  if (serveFrontend) {
    await app.register(fastifyStatic, { root: config.staticDir, wildcard: false })
  }

  app.setNotFoundHandler((req, res) => {
    const isPageNavigation =
      req.method === 'GET' && !req.url.startsWith('/api/') && Boolean(req.headers.accept?.includes('text/html'))
    if (serveFrontend && isPageNavigation) {
      return res.sendFile('index.html')
    }
    return res.code(404).send({ code: 'NOT_FOUND', message: 'Маршрут не найден' })
  })

  return app
}
