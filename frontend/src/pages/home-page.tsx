import { ArrowRight, CalendarX2, Clock, Globe } from 'lucide-react'
import { Link } from 'react-router'
import { useEventTypes, useOwner } from '@/api/queries'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration, localTimeZone } from '@/lib/format'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function HomePage() {
  const owner = useOwner()
  const eventTypes = useEventTypes()

  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-4">
        {owner.data && (
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground">
              {initials(owner.data.name)}
            </span>
            <div className="text-sm leading-tight">
              <p className="font-medium">{owner.data.name}</p>
              <p className="text-muted-foreground">Владелец календаря</p>
            </div>
          </div>
        )}
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Запишитесь на звонок
        </h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Выберите формат встречи, удобный день и свободное время — подтверждение придёт сразу,
          без переписки и согласований.
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Globe className="size-4" />
          Время показано в вашем часовом поясе: {localTimeZone()}
        </p>
      </section>

      <section aria-labelledby="event-types-heading" className="space-y-4">
        <h2 id="event-types-heading" className="text-xl font-semibold tracking-tight">
          Форматы встреч
        </h2>

        {eventTypes.error ? (
          <ErrorState message={eventTypes.error.message} onRetry={() => eventTypes.refetch()} />
        ) : eventTypes.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : eventTypes.data && eventTypes.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eventTypes.data.map((eventType) => (
              <Card
                key={eventType.id}
                data-testid="event-type-card"
                className="transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{eventType.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {formatDuration(eventType.durationMinutes)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-sm text-muted-foreground">
                  {eventType.description || 'Без описания'}
                </CardContent>
                <CardFooter>
                  <Button asChild className="h-10 w-full">
                    <Link to={`/book/${eventType.id}`}>
                      Выбрать время
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarX2 />}
            title="Пока нет доступных встреч"
            description="Владелец календаря ещё не опубликовал ни одного формата встречи. Загляните чуть позже."
            action={
              <Button asChild variant="outline">
                <Link to="/admin">Я владелец — создать тип встречи</Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  )
}
