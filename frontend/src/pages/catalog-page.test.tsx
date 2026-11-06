import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { EventType } from '@/api/client'
import { eventType, respond } from '@/test/api'
import { renderApp } from '@/test/render'

const codeReview: EventType = {
  id: 'code-review',
  name: 'Ревью кода',
  description: '',
  durationMinutes: 90,
}

describe('Каталог типов встреч', () => {
  it('показывает название, описание и длительность каждого типа встречи', async () => {
    respond('GET', '/api/event-types', [eventType, codeReview])
    renderApp('/book')

    const cards = await screen.findAllByTestId('event-type-card')
    expect(cards).toHaveLength(2)

    const intro = within(cards[0]!)
    expect(intro.getByText('Знакомство')).toBeInTheDocument()
    expect(intro.getByText('Короткий звонок, чтобы познакомиться')).toBeInTheDocument()
    expect(intro.getByText('30 мин')).toBeInTheDocument()
    expect(intro.getByRole('link', { name: 'Выбрать время' })).toHaveAttribute('href', '/book/intro-call')

    const review = within(cards[1]!)
    expect(review.getByText('Ревью кода')).toBeInTheDocument()
    expect(review.getByText('Без описания')).toBeInTheDocument()
    expect(review.getByText('1 ч 30 мин')).toBeInTheDocument()
  })

  it('сообщает, что типов встреч пока нет', async () => {
    respond('GET', '/api/event-types', [])
    renderApp('/book')

    expect(await screen.findByText('Пока нет доступных встреч')).toBeInTheDocument()
    expect(screen.queryByTestId('event-type-card')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Я владелец — создать тип встречи' })).toHaveAttribute('href', '/admin')
  })

  it('показывает ошибку загрузки и загружает список повторно', async () => {
    respond('GET', '/api/event-types', { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' }, 500)
    renderApp('/book')

    expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument()
    expect(screen.getByText('Внутренняя ошибка сервера')).toBeInTheDocument()

    respond('GET', '/api/event-types', [eventType])
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByTestId('event-type-card')).toHaveTextContent('Знакомство')
  })
})
