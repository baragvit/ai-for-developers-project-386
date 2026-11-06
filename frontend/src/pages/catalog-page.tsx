import { ArrowRight, CalendarX2, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { useEventTypes } from '@/api/queries'
import { EmptyState, ErrorState } from '@/components/states'
import { TimeZoneHint } from '@/components/time-zone-hint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/format'

export function CatalogPage() {
  const eventTypes = useEventTypes()

  return (
    <div className="space-y-8">
      <section className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Типы встреч</h1>
        <p className="text-muted-foreground text-pretty">
          Выберите тип встречи, затем удобный день и свободное время.
        </p>
        <TimeZoneHint />
      </section>

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
            <Card key={eventType.id} data-testid="event-type-card" className="transition-shadow hover:shadow-md">
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
          description="Владелец календаря ещё не опубликовал ни одного типа встречи. Загляните чуть позже."
          action={
            <Button asChild variant="outline">
              <Link to="/admin">Я владелец — создать тип встречи</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
