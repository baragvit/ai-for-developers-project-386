import { expect, test } from '@playwright/test'
import { bookViaApi, createEventType, firstAvailableSlot, moscowTime, selectDay, slotButton } from './support.js'

test.describe('Гость', () => {
  test('видит форматы встреч с названием, описанием и длительностью', async ({ page, request }) => {
    const eventType = await createEventType(request, { name: `Знакомство ${Date.now()}`, durationMinutes: 45 })

    await page.goto('/')

    const card = page.getByTestId('event-type-card').filter({ hasText: eventType.name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('45 мин')
    await expect(card).toContainText(eventType.description)
  })

  test('бронирует свободный слот, и встреча появляется у владельца', async ({ page, request }) => {
    const eventType = await createEventType(request)
    const slot = await firstAvailableSlot(request, eventType.id)
    const guestName = `Ольга Николаева ${Date.now()}`

    await page.goto('/')
    await page
      .getByTestId('event-type-card')
      .filter({ hasText: eventType.name })
      .getByRole('link', { name: 'Выбрать время' })
      .click()
    await expect(page).toHaveURL(new RegExp(`/book/${eventType.id}$`))

    await selectDay(page, slot.startAt)
    await slotButton(page, slot.startAt).first().click()
    await expect(page.getByTestId('selected-slot')).toContainText(moscowTime(slot.startAt))

    await page.getByLabel('Ваше имя').fill(guestName)
    await page.getByLabel('Email').fill('olga@example.com')
    await page.getByLabel('Комментарий').fill('Хочу обсудить интеграцию')
    await page.getByRole('button', { name: 'Записаться' }).click()

    const confirmation = page.getByTestId('booking-confirmation')
    await expect(confirmation).toContainText('Вы записаны!')
    await expect(confirmation).toContainText(moscowTime(slot.startAt))

    await page.goto('/admin')
    const row = page.getByTestId('booking-row').filter({ hasText: guestName })
    await expect(row).toContainText(eventType.name)
    await expect(row).toContainText('olga@example.com')
    await expect(row).toContainText('Хочу обсудить интеграцию')
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

  test('видит подсказки при некорректно заполненной форме', async ({ page, request }) => {
    const eventType = await createEventType(request)

    await page.goto(`/book/${eventType.id}`)
    await page.getByTestId('slot').and(page.locator(':enabled')).first().click()
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Записаться' }).click()

    await expect(page.getByText('Представьтесь, пожалуйста')).toBeVisible()
    await expect(page.getByText('Укажите корректный email')).toBeVisible()
    await expect(page.getByTestId('booking-confirmation')).toHaveCount(0)
  })
})

test.describe('Владелец', () => {
  test('создаёт тип встречи, и гости видят его на главной', async ({ page }) => {
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

    await page.goto('/')
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
