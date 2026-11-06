import { expect, type APIRequestContext, type Page } from '@playwright/test'

export type EventType = { id: string; name: string; description: string; durationMinutes: number }
export type TimeSlot = { startAt: string; endAt: string; available: boolean }

let counter = 0

/** Each test gets its own event types so tests do not depend on each other. */
export async function createEventType(
  request: APIRequestContext,
  overrides: Partial<EventType> = {},
): Promise<EventType> {
  counter += 1
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${counter}`
  const eventType: EventType = {
    id: `e2e-${suffix}`,
    name: `E2E встреча ${suffix}`,
    description: 'Создано автотестом',
    durationMinutes: 30,
    ...overrides,
  }
  const res = await request.post('/api/admin/event-types', { data: eventType })
  expect(res.status()).toBe(201)
  return eventType
}

export async function firstAvailableSlot(request: APIRequestContext, eventTypeId: string): Promise<TimeSlot> {
  const res = await request.get(`/api/event-types/${eventTypeId}/slots`)
  expect(res.ok()).toBe(true)
  const slots = (await res.json()) as TimeSlot[]
  const slot = slots.find((candidate) => candidate.available)
  if (!slot) throw new Error(`No available slots for ${eventTypeId}`)
  return slot
}

export async function bookViaApi(request: APIRequestContext, eventTypeId: string, startAt: string) {
  const res = await request.post('/api/bookings', {
    data: { eventTypeId, startAt, guestName: 'Гость из API', guestEmail: 'api-guest@example.com' },
  })
  expect(res.status()).toBe(201)
}

const moscowDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date(iso))

export const moscowTime = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )

/** «9 ноября» */
export const moscowDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' }).format(
    new Date(iso),
  )

/** Opens the calendar day containing `iso` (browser runs in Europe/Moscow), paging months if needed. */
export async function selectDay(page: Page, iso: string) {
  const cell = page.locator(`td[data-day="${moscowDay(iso)}"] button`)
  for (let i = 0; i < 2 && !(await cell.isVisible()); i += 1) {
    await page.locator('.rdp-button_next').click()
  }
  await cell.click()
}

export function slotButton(page: Page, iso: string) {
  return page.getByTestId('slot').filter({ hasText: moscowTime(iso) })
}
