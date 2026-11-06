import { describe, expect, it } from 'vitest'
import { overlaps, type Interval } from '../src/domain/model.js'

const at = (start: string, end: string): Interval => ({
  start: new Date(`2026-11-09T${start}:00Z`),
  end: new Date(`2026-11-09T${end}:00Z`),
})

describe('overlaps', () => {
  const booked = at('07:00', '08:00')

  it.each([
    ['the same interval', at('07:00', '08:00')],
    ['an interval inside', at('07:30', '07:45')],
    ['an interval covering it', at('06:30', '08:30')],
    ['an interval over its start', at('06:30', '07:30')],
    ['an interval over its end', at('07:30', '08:30')],
    ['an interval with the same start', at('07:00', '07:30')],
    ['an interval with the same end', at('07:30', '08:00')],
  ])('is true for %s', (_, other) => {
    expect(overlaps(booked, other)).toBe(true)
    expect(overlaps(other, booked)).toBe(true)
  })

  it.each([
    ['an interval ending at its start', at('06:00', '07:00')],
    ['an interval starting at its end', at('08:00', '09:00')],
    ['an interval far before', at('05:00', '06:00')],
    ['an interval far after', at('09:00', '10:00')],
  ])('is false for %s', (_, other) => {
    expect(overlaps(booked, other)).toBe(false)
    expect(overlaps(other, booked)).toBe(false)
  })
})
