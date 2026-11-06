import type { EventTypeRepository } from './storage/repositories.js'

export function seedDemoEventTypes(eventTypes: EventTypeRepository) {
  eventTypes.insert({
    id: 'consultation',
    name: 'Консультация',
    description: 'Обсудим ваш проект, задачи и ответим на вопросы.',
    durationMinutes: 30,
  })
  eventTypes.insert({
    id: 'code-review',
    name: 'Ревью кода',
    description: 'Совместно разберём пулл-реквест и договоримся об улучшениях.',
    durationMinutes: 45,
  })
  eventTypes.insert({
    id: 'tech-interview',
    name: 'Техническое интервью',
    description: 'Часовой созвон: задачи, вопросы по архитектуре и разбор решений.',
    durationMinutes: 60,
  })
}
