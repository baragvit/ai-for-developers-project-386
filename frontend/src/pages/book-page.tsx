import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarCheck2, CalendarX2, CheckCircle2, Clock, Globe, Loader2, User } from 'lucide-react'
import { ru } from 'react-day-picker/locale'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import type { Booking, EventType, TimeSlot } from '@/api/client'
import { useCreateBooking, useEventType, useSlots } from '@/api/queries'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  capitalize,
  dayKey,
  formatDayLong,
  formatDuration,
  formatTime,
  formatTimeRange,
  localTimeZone,
} from '@/lib/format'
import { cn } from '@/lib/utils'

export function BookPage() {
  const { eventTypeId = '' } = useParams()
  const eventType = useEventType(eventTypeId)
  const slots = useSlots(eventTypeId)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot>()
  const [lastViewedDay, setLastViewedDay] = useState<Date>()
  const [booking, setBooking] = useState<Booking>()

  if (eventType.error?.code === 'NOT_FOUND') {
    return (
      <EmptyState
        icon={<CalendarX2 />}
        title="Такой встречи нет"
        description="Возможно, владелец удалил этот тип встречи или ссылка содержит опечатку."
        action={
          <Button asChild variant="outline">
            <Link to="/book">К типам встреч</Link>
          </Button>
        }
      />
    )
  }

  if (eventType.error || slots.error) {
    const error = eventType.error ?? slots.error
    return (
      <ErrorState
        message={error!.message}
        onRetry={() => {
          void eventType.refetch()
          void slots.refetch()
        }}
      />
    )
  }

  if (!eventType.data || !slots.data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    )
  }

  const handleBooked = (created: Booking) => {
    setBooking(created)
    setSelectedSlot(undefined)
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/book">
          <ArrowLeft />
          Все типы встреч
        </Link>
      </Button>

      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <EventSummary eventType={eventType.data} />

        {booking ? (
          <BookingConfirmation booking={booking} onBookAnother={() => setBooking(undefined)} />
        ) : selectedSlot ? (
          <GuestForm
            eventType={eventType.data}
            slot={selectedSlot}
            onBack={() => setSelectedSlot(undefined)}
            onBooked={handleBooked}
            onSlotLost={() => setSelectedSlot(undefined)}
          />
        ) : (
          <SlotPicker
            slots={slots.data}
            initialDay={lastViewedDay}
            onPick={(slot) => {
              setSelectedSlot(slot)
              setLastViewedDay(new Date(slot.startAt))
            }}
          />
        )}
      </div>
    </div>
  )
}

function EventSummary({ eventType }: { eventType: EventType }) {
  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">{eventType.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2 text-muted-foreground">
          <p className="flex items-center gap-2">
            <Clock className="size-4" />
            {formatDuration(eventType.durationMinutes)}
          </p>
          <p className="flex items-center gap-2">
            <Globe className="size-4" />
            {localTimeZone()}
          </p>
        </div>
        {eventType.description && (
          <>
            <Separator />
            <p className="leading-relaxed">{eventType.description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SlotPicker({
  slots,
  initialDay,
  onPick,
}: {
  slots: TimeSlot[]
  initialDay: Date | undefined
  onPick: (slot: TimeSlot) => void
}) {
  const slotsByDay = useMemo(() => {
    const groups = new Map<string, TimeSlot[]>()
    for (const slot of slots) {
      const key = dayKey(slot.startAt)
      groups.set(key, [...(groups.get(key) ?? []), slot])
    }
    return groups
  }, [slots])

  const bookableDays = useMemo(
    () =>
      new Set(
        [...slotsByDay.entries()]
          .filter(([, daySlots]) => daySlots.some((slot) => slot.available))
          .map(([key]) => key),
      ),
    [slotsByDay],
  )

  const firstBookable = slots.find((slot) => slot.available)
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(
    initialDay ?? (firstBookable ? new Date(firstBookable.startAt) : undefined),
  )

  if (!firstBookable) {
    return (
      <EmptyState
        icon={<CalendarX2 />}
        title="Свободного времени нет"
        description="Все слоты на ближайшие две недели заняты. Попробуйте выбрать другой тип встречи или загляните позже."
        action={
          <Button asChild variant="outline">
            <Link to="/book">Другие типы встреч</Link>
          </Button>
        }
      />
    )
  }

  const daySlots = selectedDay ? (slotsByDay.get(dayKey(selectedDay)) ?? []) : []
  const firstDay = new Date(slots[0].startAt)
  const lastDay = new Date(slots[slots.length - 1].startAt)

  return (
    <Card className="gap-0 py-0">
      <div className="grid md:grid-cols-[auto_1fr]">
        <div className="border-b p-4 md:border-r md:border-b-0 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold">Выберите день</h2>
          <Calendar
            mode="single"
            locale={ru}
            selected={selectedDay}
            onSelect={(day) => day && setSelectedDay(day)}
            defaultMonth={selectedDay ?? firstDay}
            startMonth={firstDay}
            endMonth={lastDay}
            disabled={(date) => !bookableDays.has(dayKey(date))}
            showOutsideDays={false}
            className="mx-auto bg-transparent p-0 [--cell-size:--spacing(10)]"
          />
        </div>

        <div className="p-4 sm:p-6">
          <h2 className="mb-1 text-sm font-semibold">
            {selectedDay ? capitalize(formatDayLong(selectedDay)) : 'Выберите день'}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Свободное время</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 xl:grid-cols-4">
            {daySlots.map((slot) => (
              <Button
                key={slot.startAt}
                data-testid="slot"
                variant="outline"
                disabled={!slot.available}
                title={slot.available ? undefined : 'Это время уже занято'}
                onClick={() => onPick(slot)}
                className={cn(
                  'h-10 font-medium tabular-nums hover:border-primary hover:bg-accent hover:text-accent-foreground',
                  !slot.available && 'line-through',
                )}
              >
                {formatTime(slot.startAt)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

type FormErrors = Partial<Record<'guestName' | 'guestEmail' | 'comment', string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateGuest(values: { guestName: string; guestEmail: string; comment: string }): FormErrors {
  const errors: FormErrors = {}
  if (!values.guestName.trim()) errors.guestName = 'Представьтесь, пожалуйста'
  else if (values.guestName.trim().length > 100) errors.guestName = 'Не длиннее 100 символов'
  if (!EMAIL_PATTERN.test(values.guestEmail.trim())) errors.guestEmail = 'Укажите корректный email'
  else if (values.guestEmail.trim().length > 254) errors.guestEmail = 'Не длиннее 254 символов'
  if (values.comment.length > 1000) errors.comment = 'Не длиннее 1000 символов'
  return errors
}

function GuestForm({
  eventType,
  slot,
  onBack,
  onBooked,
  onSlotLost,
}: {
  eventType: EventType
  slot: TimeSlot
  onBack: () => void
  onBooked: (booking: Booking) => void
  onSlotLost: () => void
}) {
  const [values, setValues] = useState({ guestName: '', guestEmail: '', comment: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const createBooking = useCreateBooking()

  const update = (field: keyof typeof values) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const clientErrors = validateGuest(values)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    createBooking.mutate(
      {
        eventTypeId: eventType.id,
        startAt: slot.startAt,
        guestName: values.guestName.trim(),
        guestEmail: values.guestEmail.trim(),
        comment: values.comment.trim() || undefined,
      },
      {
        onSuccess: onBooked,
        onError: (error) => {
          if (error.code === 'SLOT_TAKEN' || error.code === 'SLOT_UNAVAILABLE') {
            toast.error(error.message)
            onSlotLost()
          } else if (error.code === 'VALIDATION_ERROR' && error.details.length > 0) {
            setErrors(Object.fromEntries(error.details.map((d) => [d.field, d.message])))
          } else {
            toast.error(error.message)
          }
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={onBack}>
          <ArrowLeft />
          Выбрать другое время
        </Button>
        <div
          data-testid="booking-summary"
          className="flex items-start gap-3 rounded-lg bg-accent p-3 text-accent-foreground"
        >
          <CalendarCheck2 className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{capitalize(formatDayLong(slot.startAt))}</p>
            <p>
              {formatTimeRange(slot.startAt, slot.endAt)} · {eventType.name}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          <FormField id="guestName" label="Ваше имя" error={errors.guestName}>
            <Input
              id="guestName"
              autoComplete="name"
              placeholder="Иван Петров"
              value={values.guestName}
              aria-invalid={Boolean(errors.guestName)}
              onChange={(e) => update('guestName')(e.target.value)}
            />
          </FormField>
          <FormField id="guestEmail" label="Email" error={errors.guestEmail}>
            <Input
              id="guestEmail"
              type="email"
              autoComplete="email"
              placeholder="ivan@example.com"
              value={values.guestEmail}
              aria-invalid={Boolean(errors.guestEmail)}
              onChange={(e) => update('guestEmail')(e.target.value)}
            />
          </FormField>
          <FormField id="comment" label="Комментарий" hint="Необязательно" error={errors.comment}>
            <Textarea
              id="comment"
              rows={3}
              placeholder="Что хотите обсудить?"
              value={values.comment}
              aria-invalid={Boolean(errors.comment)}
              onChange={(e) => update('comment')(e.target.value)}
            />
          </FormField>
          <Button type="submit" className="h-10 w-full sm:w-auto sm:px-6" disabled={createBooking.isPending}>
            {createBooking.isPending ? <Loader2 className="animate-spin" /> : <User />}
            Записаться
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function BookingConfirmation({ booking, onBookAnother }: { booking: Booking; onBookAnother: () => void }) {
  return (
    <Card data-testid="booking-confirmation">
      <CardContent className="flex flex-col items-center py-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Запись подтверждена</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          {booking.guestName}, ждём вас на встрече «{booking.eventTypeName}».
        </p>
        <div className="mt-6 w-full max-w-sm space-y-1 rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-semibold">{capitalize(formatDayLong(booking.startAt))}</p>
          <p>{formatTimeRange(booking.startAt, booking.endAt)}</p>
          <p className="text-muted-foreground">{booking.guestEmail}</p>
          {booking.comment && <p className="break-words text-muted-foreground">{booking.comment}</p>}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onBookAnother}>
            Записаться ещё раз
          </Button>
          <Button asChild>
            <Link to="/book">Другие типы встреч</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
