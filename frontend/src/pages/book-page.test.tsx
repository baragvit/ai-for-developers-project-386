import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { TimeSlot } from '@/api/client'
import { eventType, respond } from '@/test/api'
import { renderApp } from '@/test/render'

// Component tests run in Asia/Vladivostok (UTC+10); the owner works 09:00–18:00 in Moscow (UTC+3).
const slots: TimeSlot[] = [
  // Monday 9 November, 09:00 in Moscow — 16:00 on Monday in Vladivostok.
  { startAt: '2026-11-09T06:00:00.000Z', endAt: '2026-11-09T06:30:00.000Z', available: false },
  // Monday 9 November, 17:30 in Moscow — 00:30 on Tuesday in Vladivostok.
  { startAt: '2026-11-09T14:30:00.000Z', endAt: '2026-11-09T15:00:00.000Z', available: true },
  { startAt: '2026-11-10T06:00:00.000Z', endAt: '2026-11-10T06:30:00.000Z', available: false },
  { startAt: '2026-11-10T06:30:00.000Z', endAt: '2026-11-10T07:00:00.000Z', available: true },
  // Friday 13 November, 17:30 in Moscow — 00:30 on Saturday in Vladivostok.
  { startAt: '2026-11-13T14:30:00.000Z', endAt: '2026-11-13T15:00:00.000Z', available: true },
]

const openBookPage = (eventTypeSlots: TimeSlot[]) => {
  respond('GET', `/api/event-types/${eventType.id}`, eventType)
  respond('GET', `/api/event-types/${eventType.id}/slots`, eventTypeSlots)
  renderApp(`/book/${eventType.id}`)
}

const calendarDay = (dayOfNovember: number) =>
  screen.getByRole('button', { name: new RegExp(`, ${dayOfNovember} ноября 2026`) })

const shownSlots = () =>
  screen.getAllByTestId('slot').map((slot) => ({
    time: slot.textContent,
    available: !(slot as HTMLButtonElement).disabled,
  }))

describe('Календарь свободных слотов', () => {
  it('раскладывает слоты по дням в часовом поясе гостя и выбирает первый день со свободным слотом', async () => {
    openBookPage(slots)

    expect(await screen.findByRole('heading', { name: 'Вторник, 10 ноября' })).toBeInTheDocument()
    expect(shownSlots()).toEqual([
      { time: '00:30', available: true },
      { time: '16:00', available: false },
      { time: '16:30', available: true },
    ])
    expect(screen.getByText('Asia/Vladivostok')).toBeInTheDocument()
  })

  it('зачёркивает занятые слоты', async () => {
    openBookPage(slots)

    const taken = (await screen.findAllByTestId('slot')).find((slot) => slot.textContent === '16:00')!
    expect(taken).toBeDisabled()
    expect(taken).toHaveClass('line-through')
    expect(taken).toHaveAttribute('title', 'Это время уже занято')
  })

  it('делает активными только дни, где у гостя есть свободный слот', async () => {
    openBookPage(slots)
    await screen.findAllByTestId('slot')

    // Monday has only a taken slot; the owner's Friday evening is Saturday for the guest.
    expect(calendarDay(9)).toBeDisabled()
    expect(calendarDay(10)).toBeEnabled()
    expect(calendarDay(11)).toBeDisabled()
    expect(calendarDay(13)).toBeDisabled()
    expect(calendarDay(14)).toBeEnabled()
    expect(calendarDay(15)).toBeDisabled()

    await userEvent.click(calendarDay(14))

    expect(screen.getByRole('heading', { name: 'Суббота, 14 ноября' })).toBeInTheDocument()
    expect(shownSlots()).toEqual([{ time: '00:30', available: true }])
  })

  it('сообщает, что свободного времени нет, когда все слоты окна заняты', async () => {
    openBookPage(slots.map((slot) => ({ ...slot, available: false })))

    expect(await screen.findByText('Свободного времени нет')).toBeInTheDocument()
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Другие типы встреч' })).toHaveAttribute('href', '/book')
  })

  it('сообщает, что свободного времени нет, когда в окне нет слотов', async () => {
    openBookPage([])

    expect(await screen.findByText('Свободного времени нет')).toBeInTheDocument()
  })

  it('показывает состояние «не найдено» для неизвестного типа встречи', async () => {
    const notFound = { code: 'NOT_FOUND', message: 'Тип встречи не найден' }
    respond('GET', '/api/event-types/missing', notFound, 404)
    respond('GET', '/api/event-types/missing/slots', notFound, 404)
    renderApp('/book/missing')

    expect(await screen.findByText('Такой встречи нет')).toBeInTheDocument()
    expect(screen.queryByText('Не удалось загрузить данные')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К типам встреч' })).toHaveAttribute('href', '/book')
  })
})

describe('Форма записи', () => {
  it('показывает серверные ошибки валидации у соответствующих полей формы', async () => {
    openBookPage(slots)
    await userEvent.click((await screen.findAllByTestId('slot'))[0]!)
    respond(
      'POST',
      '/api/bookings',
      {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте правильность заполнения полей',
        details: [
          { field: 'guestEmail', message: 'Укажите корректный email' },
          { field: 'comment', message: 'Не длиннее 1000 символов' },
        ],
      },
      400,
    )

    await userEvent.type(screen.getByLabelText('Ваше имя'), 'Ольга')
    await userEvent.type(screen.getByLabelText('Email'), 'olga@example.c')
    await userEvent.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(await screen.findByText('Укажите корректный email')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Комментарий/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Ваше имя')).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByLabelText('Email')).toHaveValue('olga@example.c')
  })
})
