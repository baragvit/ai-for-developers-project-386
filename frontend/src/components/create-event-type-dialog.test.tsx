import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EventType } from '@/api/client'
import { eventType, respond, wasRequested } from '@/test/api'
import { renderApp } from '@/test/render'

const created: EventType = {
  id: 'mentor-session',
  name: 'Менторская сессия',
  description: 'Разбор карьерных вопросов',
  durationMinutes: 45,
}

async function openDialog() {
  renderApp('/admin')
  await userEvent.click(screen.getByRole('button', { name: 'Новый тип встречи' }))
  return within(await screen.findByRole('dialog'))
}

async function fill(dialog: ReturnType<typeof within>, values: Partial<Record<string, string>>) {
  for (const [label, value] of Object.entries(values)) {
    const field = dialog.getByLabelText(new RegExp(`^${label}`))
    await userEvent.clear(field)
    if (value) await userEvent.type(field, value)
  }
}

describe('Диалог создания типа встречи', () => {
  beforeEach(() => {
    respond('GET', '/api/admin/bookings', [])
    respond('GET', '/api/event-types', [eventType])
  })

  it('создаёт тип встречи и показывает его в списке', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: created.name, Идентификатор: created.id, Описание: created.description })
    await userEvent.click(dialog.getByRole('button', { name: '45 мин' }))

    respond('POST', '/api/admin/event-types', created, 201)
    respond('GET', '/api/event-types', [eventType, created])
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('Тип встречи «Менторская сессия» создан')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Типы встреч/ }))
    const cards = await screen.findAllByTestId('admin-event-type')
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('Знакомство'),
      expect.stringContaining('Менторская сессия'),
    ])
  })

  it('показывает ошибки у полей до отправки', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Идентификатор: 'Bad id', 'Длительность, минут': '7', Описание: 'я'.repeat(501) })
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(dialog.getByLabelText('Название')).toHaveAccessibleDescription('Укажите название')
    expect(dialog.getByLabelText(/^Идентификатор/)).toHaveAccessibleDescription(
      'Только латиница в нижнем регистре, цифры и дефисы',
    )
    expect(dialog.getByLabelText('Длительность, минут')).toHaveAccessibleDescription(
      'Длительность должна быть кратна 5 минутам',
    )
    expect(dialog.getByLabelText(/^Описание/)).toHaveAccessibleDescription('Не длиннее 500 символов')
    expect(wasRequested('POST', '/api/admin/event-types')).toBe(false)
  })

  it.each([
    ['4', 'Целое число от 5 до 240 минут'],
    ['245', 'Целое число от 5 до 240 минут'],
    ['12.5', 'Целое число от 5 до 240 минут'],
  ])('не принимает длительность %s', async (duration, message) => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Созвон', 'Длительность, минут': duration })
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(dialog.getByLabelText('Длительность, минут')).toHaveAccessibleDescription(message)
  })

  it('показывает серверные ошибки валидации у соответствующих полей', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Созвон' })

    respond(
      'POST',
      '/api/admin/event-types',
      {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте правильность заполнения полей',
        details: [{ field: 'durationMinutes', message: 'Должно быть кратно 5' }],
      },
      400,
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await dialog.findByText('Должно быть кратно 5')).toBeInTheDocument()
    expect(dialog.getByLabelText('Длительность, минут')).toHaveAccessibleDescription('Должно быть кратно 5')
  })

  it('показывает занятый id у поля «Идентификатор» и не закрывается', async () => {
    const dialog = await openDialog()
    await fill(dialog, { Название: 'Знакомство', Идентификатор: eventType.id })

    respond(
      'POST',
      '/api/admin/event-types',
      { code: 'EVENT_TYPE_ALREADY_EXISTS', message: 'Тип встречи с таким id уже существует' },
      409,
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Создать' }))

    expect(await dialog.findByText('Такой id уже занят — придумайте другой')).toBeInTheDocument()
    expect(dialog.getByLabelText(/^Идентификатор/)).toHaveAccessibleDescription(
      'Такой id уже занят — придумайте другой',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
