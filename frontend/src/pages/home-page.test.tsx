import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { eventType, owner, respond } from '@/test/api'
import { renderApp } from '@/test/render'

const main = () => within(screen.getByRole('main'))

describe('Главная страница', () => {
  it('рассказывает о сервисе и ведёт кнопкой «Записаться» в каталог типов встреч', async () => {
    respond('GET', '/api/owner', owner)
    respond('GET', '/api/event-types', [eventType])
    renderApp('/')

    expect(main().getByRole('heading', { level: 1, name: 'Запишитесь на звонок' })).toBeInTheDocument()

    await userEvent.click(main().getByRole('link', { name: 'Записаться' }))

    expect(window.location.pathname).toBe('/book')
    expect(await main().findByRole('heading', { level: 1, name: 'Типы встреч' })).toBeInTheDocument()
    expect(await main().findByText(eventType.name)).toBeInTheDocument()
  })

  it('объясняет запись в три шага', () => {
    respond('GET', '/api/owner', owner)
    renderApp('/')

    const howItWorks = within(screen.getByRole('region', { name: 'Как это работает' }))
    const steps = howItWorks.getAllByRole('listitem').map((step) => step.textContent)

    expect(steps).toEqual([
      expect.stringContaining('Выберите тип встречи'),
      expect.stringContaining('Выберите день и свободное время'),
      expect.stringContaining('Оставьте имя и email'),
    ])
  })

  it('показывает владельца календаря, его рабочее время и окно записи', async () => {
    respond('GET', '/api/owner', owner)
    renderApp('/')

    const card = within(await screen.findByRole('region', { name: 'Владелец календаря' }))

    expect(await card.findByText('Анна Смирнова')).toBeInTheDocument()
    expect(card.getByText('пн–пт, 09:00–18:00')).toBeInTheDocument()
    expect(card.getByText('Europe/Moscow')).toBeInTheDocument()
    expect(card.getByText('Запись открыта на 14 дней вперёд')).toBeInTheDocument()
  })

  it('предупреждает, что время показано в часовом поясе гостя', () => {
    respond('GET', '/api/owner', owner)
    renderApp('/')

    expect(main().getByText('Время показано в вашем часовом поясе: Asia/Vladivostok')).toBeInTheDocument()
  })

  it('показывает ошибку загрузки владельца, ведёт в каталог и загружает владельца повторно', async () => {
    respond('GET', '/api/owner', { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' }, 500)
    renderApp('/')

    const card = within(screen.getByRole('region', { name: 'Владелец календаря' }))
    expect(await card.findByText('Не удалось загрузить данные владельца')).toBeInTheDocument()
    expect(card.getByText('Внутренняя ошибка сервера')).toBeInTheDocument()
    expect(main().getByRole('link', { name: 'Записаться' })).toHaveAttribute('href', '/book')
    expect(screen.getByRole('region', { name: 'Как это работает' })).toBeInTheDocument()

    respond('GET', '/api/owner', owner)
    await userEvent.click(card.getByRole('button', { name: 'Повторить' }))

    expect(await card.findByText('Анна Смирнова')).toBeInTheDocument()
    expect(card.queryByText('Не удалось загрузить данные владельца')).not.toBeInTheDocument()
  })
})
