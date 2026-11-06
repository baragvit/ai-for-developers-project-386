export type EventType = {
  id: string
  name: string
  description: string
  durationMinutes: number
}

export type Interval = {
  start: Date
  end: Date
}

export type Booking = {
  id: string
  eventTypeId: string
  eventTypeName: string
  interval: Interval
  guestName: string
  guestEmail: string
  comment: string | undefined
  createdAt: Date
}

export type Slot = {
  interval: Interval
  available: boolean
}

/** Local wall-clock time in the owner's time zone. */
export type TimeOfDay = {
  hours: number
  minutes: number
}

export type Owner = {
  name: string
  timezone: string
  workdayStart: TimeOfDay
  workdayEnd: TimeOfDay
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  workingDays: ReadonlySet<number>
  bookingWindowDays: number
}

export type NewBooking = {
  eventTypeId: string
  start: Date
  guestName: string
  guestEmail: string
  comment: string | undefined
}

export type DomainError =
  | { kind: 'EventTypeNotFound'; eventTypeId: string }
  | { kind: 'EventTypeAlreadyExists'; eventTypeId: string }
  | { kind: 'SlotUnavailable'; start: Date }
  | { kind: 'SlotTaken'; start: Date }

export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end
