import { expect, test } from '@playwright/test'
import {
  bookViaApi,
  createEventType,
  firstAvailableSlot,
  moscowDate,
  moscowTime,
  selectDay,
  slotButton,
} from './support.js'

test.describe('Гость', () => {
  test('с главной страницы переходит в каталог и видит типы встреч', async ({ page, request }) => {
    const eventType = await createEventType(request, { durationMinutes: 60 })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Запишитесь на звонок' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Владелец календаря' })).toBeVisible()

    await page.getByRole('main').getByRole('link', { name: 'Записаться' }).click()

    await expect(page).toHaveURL(/\/book$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Типы встреч' })).toBeVisible()
    const card = page.getByTestId('event-type-card').filter({ hasText: eventType.name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('1 ч')
    await expect(card).toContainText(eventType.description)
  })

  test('бронирует свободный слот, и встреча появляется у владельца', async ({ page, request }) => {
    const eventType = await createEventType(request)
    const slot = await firstAvailableSlot(request, eventType.id)
    const guestName = `Ольга Николаева ${Date.now()}`

    await page.goto('/book')
    await page
      .getByTestId('event-type-card')
      .filter({ hasText: eventType.name })
      .getByRole('link', { name: 'Выбрать время' })
      .click()
    await expect(page).toHaveURL(new RegExp(`/book/${eventType.id}$`))

    await selectDay(page, slot.startAt)
    await slotButton(page, slot.startAt).click()
    const summary = page.getByTestId('booking-summary')
    await expect(summary).toContainText(moscowDate(slot.startAt))
    await expect(summary).toContainText(moscowTime(slot.startAt))
    await expect(summary).toContainText(eventType.name)

    await page.getByLabel('Ваше имя').fill(guestName)
    await page.getByLabel('Email').fill('olga@example.com')
    await page.getByLabel('Комментарий').fill('Хочу обсудить интеграцию')
    await page.getByRole('button', { name: 'Записаться' }).click()

    const confirmation = page.getByTestId('booking-confirmation')
    await expect(confirmation.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible()
    await expect(confirmation).toContainText(eventType.name)
    await expect(confirmation).toContainText(moscowDate(slot.startAt))
    await expect(confirmation).toContainText(moscowTime(slot.startAt))
    await expect(confirmation).toContainText(guestName)
    await expect(confirmation).toContainText('olga@example.com')
    await expect(confirmation).toContainText('Хочу обсудить интеграцию')

    await confirmation.getByRole('button', { name: 'Записаться ещё раз' }).click()
    await selectDay(page, slot.startAt)
    await expect(slotButton(page, slot.startAt)).toBeDisabled()

    await page.goto('/admin')
    await expect(page.getByRole('tab', { name: /Предстоящие встречи/ })).toHaveAttribute('aria-selected', 'true')
    const row = page.getByTestId('booking-row').filter({ hasText: guestName })
    await expect(row).toContainText(moscowTime(slot.startAt))
    await expect(row).toContainText(eventType.name)
    await expect(row).toContainText('olga@example.com')
    await expect(row).toContainText('Хочу обсудить интеграцию')
  })

  test('из подтверждения переходит к другим типам встреч', async ({ page, request }) => {
    const eventType = await createEventType(request)
    const slot = await firstAvailableSlot(request, eventType.id)

    await page.goto(`/book/${eventType.id}`)
    await selectDay(page, slot.startAt)
    await slotButton(page, slot.startAt).click()
    await page.getByLabel('Ваше имя').fill('Ольга')
    await page.getByLabel('Email').fill('olga@example.com')
    await page.getByRole('button', { name: 'Записаться' }).click()

    await page.getByTestId('booking-confirmation').getByRole('link', { name: 'Другие типы встреч' }).click()

    await expect(page).toHaveURL(/\/book$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Типы встреч' })).toBeVisible()
  })

  test('не может выбрать время, занятое встречей другого типа', async ({ page, request }) => {
    const first = await createEventType(request)
    const second = await createEventType(request)
    const slot = await firstAvailableSlot(request, first.id)
    await bookViaApi(request, first.id, slot.startAt)

    await page.goto(`/book/${second.id}`)
    await selectDay(page, slot.startAt)

    await expect(slotButton(page, slot.startAt)).toBeDisabled()
  })

  test('получает понятную ошибку, если слот заняли, пока он заполнял форму', async ({ page, request }) => {
    const eventType = await createEventType(request)
    const slot = await firstAvailableSlot(request, eventType.id)

    await page.goto(`/book/${eventType.id}`)
    await selectDay(page, slot.startAt)
    await slotButton(page, slot.startAt).click()
    await page.getByLabel('Ваше имя').fill('Пётр')
    await page.getByLabel('Email').fill('petr@example.com')

    await bookViaApi(request, eventType.id, slot.startAt)
    await page.getByRole('button', { name: 'Записаться' }).click()

    await expect(page.getByText('Это время только что заняли')).toBeVisible()
    await expect(slotButton(page, slot.startAt)).toBeDisabled()
  })

  test('видит ошибки у полей формы и не записывается, пока они не исправлены', async ({ page, request }) => {
    const eventType = await createEventType(request)
    const slot = await firstAvailableSlot(request, eventType.id)
    const bookingRequests: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().endsWith('/api/bookings')) bookingRequests.push(req.url())
    })

    await page.goto(`/book/${eventType.id}`)
    await selectDay(page, slot.startAt)
    await slotButton(page, slot.startAt).click()
    await page.getByRole('button', { name: 'Записаться' }).click()

    await expect(page.getByText('Представьтесь, пожалуйста')).toBeVisible()
    await expect(page.getByText('Укажите корректный email')).toBeVisible()
    await expect(page.getByLabel('Ваше имя')).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('Ваше имя').fill('Ольга')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Комментарий').fill('я'.repeat(1001))
    await page.getByRole('button', { name: 'Записаться' }).click()

    await expect(page.getByText('Представьтесь, пожалуйста')).toBeHidden()
    await expect(page.getByText('Укажите корректный email')).toBeVisible()
    await expect(page.getByText('Не длиннее 1000 символов')).toBeVisible()
    expect(bookingRequests).toEqual([])

    await page.getByLabel('Email').fill('olga@example.com')
    await page.getByLabel('Комментарий').fill('Коротко')
    await page.getByRole('button', { name: 'Записаться' }).click()

    await expect(page.getByTestId('booking-confirmation')).toBeVisible()
    expect(bookingRequests).toHaveLength(1)
  })

  test('возвращается к выбору времени из формы', async ({ page, request }) => {
    const eventType = await createEventType(request)
    const slot = await firstAvailableSlot(request, eventType.id)

    await page.goto(`/book/${eventType.id}`)
    await selectDay(page, slot.startAt)
    await slotButton(page, slot.startAt).click()
    await page.getByRole('button', { name: 'Выбрать другое время' }).click()

    await expect(page.getByLabel('Ваше имя')).toBeHidden()
    await expect(slotButton(page, slot.startAt)).toBeEnabled()
  })
})

test.describe('Владелец', () => {
  test('создаёт тип встречи, и гости видят его в каталоге', async ({ page }) => {
    const name = `Менторская сессия ${Date.now()}`

    await page.goto('/admin')
    await page.getByRole('button', { name: 'Новый тип встречи' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Название').fill(name)
    await expect(dialog.getByLabel('Идентификатор')).toHaveValue(/^mentorskaya-sessiya-\d+$/)
    await dialog.getByRole('button', { name: '60 мин' }).click()
    await dialog.getByLabel('Описание').fill('Разбор карьерных вопросов')
    await dialog.getByRole('button', { name: 'Создать' }).click()

    await expect(dialog).toBeHidden()
    await page.getByRole('tab', { name: /Типы встреч/ }).click()
    await expect(page.getByTestId('admin-event-type').filter({ hasText: name })).toContainText('1 ч')

    await page.goto('/book')
    await expect(page.getByTestId('event-type-card').filter({ hasText: name })).toBeVisible()
  })

  test('не может создать тип встречи с уже занятым id', async ({ page, request }) => {
    const existing = await createEventType(request)

    await page.goto('/admin')
    await page.getByRole('button', { name: 'Новый тип встречи' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Название').fill('Дубликат')
    await dialog.getByLabel('Идентификатор').fill(existing.id)
    await dialog.getByRole('button', { name: 'Создать' }).click()

    await expect(dialog.getByText('Такой id уже занят')).toBeVisible()
  })
})
