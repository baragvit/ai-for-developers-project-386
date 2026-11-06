import { useMemo, useState } from 'react'
import { CalendarDays, Clock, ExternalLink, Inbox, Mail, MessageSquare, Plus } from 'lucide-react'
import { Link } from 'react-router'
import type { Booking } from '@/api/client'
import { useEventTypes, useUpcomingBookings } from '@/api/queries'
import { CreateEventTypeDialog } from '@/components/create-event-type-dialog'
import { EmptyState, ErrorState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { capitalize, dayKey, formatDayLong, formatDuration, formatTimeRange, localTimeZone } from '@/lib/format'

export function AdminPage() {
  const bookings = useUpcomingBookings()
  const eventTypes = useEventTypes()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Кабинет владельца</h1>
        <p className="text-muted-foreground">
          Управляйте форматами встреч и следите за записями. Время показано в часовом поясе{' '}
          {localTimeZone()}.
        </p>
      </div>

      <Tabs defaultValue="bookings" className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="bookings" className="px-3">
              Предстоящие встречи
              {bookings.data && <Badge variant="secondary">{bookings.data.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="event-types" className="px-3">
              Типы встреч
              {eventTypes.data && <Badge variant="secondary">{eventTypes.data.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <Button className="h-9" onClick={() => setCreateOpen(true)}>
            <Plus />
            Новый тип встречи
          </Button>
        </div>

        <TabsContent value="bookings">
          {bookings.error ? (
            <ErrorState message={bookings.error.message} onRetry={() => bookings.refetch()} />
          ) : !bookings.data ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : bookings.data.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="Записей пока нет"
              description="Когда гости запишутся на звонок, встречи появятся здесь одним списком."
              action={
                <Button asChild variant="outline">
                  <Link to="/">Открыть страницу записи</Link>
                </Button>
              }
            />
          ) : (
            <BookingList bookings={bookings.data} />
          )}
        </TabsContent>

        <TabsContent value="event-types">
          {eventTypes.error ? (
            <ErrorState message={eventTypes.error.message} onRetry={() => eventTypes.refetch()} />
          ) : !eventTypes.data ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : eventTypes.data.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="Нет ни одного типа встречи"
              description="Создайте первый формат — например, «Консультация» на 30 минут, — и гости смогут на него записаться."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Создать тип встречи
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {eventTypes.data.map((eventType) => (
                <Card key={eventType.id} data-testid="admin-event-type">
                  <CardHeader>
                    <CardTitle>{eventType.name}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {eventType.id}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {formatDuration(eventType.durationMinutes)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground">
                    {eventType.description || 'Без описания'}
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/book/${eventType.id}`}>
                        Страница записи
                        <ExternalLink />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateEventTypeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function BookingList({ bookings }: { bookings: Booking[] }) {
  const groups = useMemo(() => {
    const byDay = new Map<string, Booking[]>()
    for (const booking of bookings) {
      const key = dayKey(booking.startAt)
      byDay.set(key, [...(byDay.get(key) ?? []), booking])
    }
    return [...byDay.values()]
  }, [bookings])

  return (
    <div className="space-y-8">
      {groups.map((dayBookings) => (
        <section key={dayKey(dayBookings[0].startAt)} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {capitalize(formatDayLong(dayBookings[0].startAt))}
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {dayBookings.map((booking) => (
              <li
                key={booking.id}
                data-testid="booking-row"
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-6"
              >
                <div className="w-32 shrink-0 font-semibold tabular-nums">
                  {formatTimeRange(booking.startAt, booking.endAt)}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{booking.guestName}</span>
                    <Badge variant="secondary">{booking.eventTypeName}</Badge>
                  </div>
                  <a
                    href={`mailto:${booking.guestEmail}`}
                    className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="size-3.5" />
                    {booking.guestEmail}
                  </a>
                  {booking.comment && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
                      <span className="break-words">{booking.comment}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
