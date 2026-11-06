import { ArrowRight, CalendarCheck, CalendarDays, MousePointerClick } from 'lucide-react'
import { Link } from 'react-router'
import type { Owner } from '@/api/client'
import { useOwner } from '@/api/queries'
import { ErrorState } from '@/components/states'
import { TimeZoneHint } from '@/components/time-zone-hint'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDays, formatWorkingDays } from '@/lib/format'

const steps = [
  {
    icon: MousePointerClick,
    title: 'Выберите тип встречи',
    text: 'У каждого типа своя длительность и описание.',
  },
  {
    icon: CalendarDays,
    title: 'Выберите день и свободное время',
    text: 'Календарь показывает только свободные слоты.',
  },
  {
    icon: CalendarCheck,
    title: 'Оставьте имя и email',
    text: 'Запись подтверждается сразу, владелец увидит её в своём списке.',
  },
]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function OwnerSection() {
  const owner = useOwner()

  return (
    <section aria-labelledby="owner-heading" className="max-w-xl space-y-4">
      <h2 id="owner-heading" className="text-xl font-semibold tracking-tight">
        Владелец календаря
      </h2>
      {owner.error ? (
        <ErrorState
          title="Не удалось загрузить данные владельца"
          message={owner.error.message}
          onRetry={() => owner.refetch()}
        />
      ) : owner.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <OwnerCard owner={owner.data} />
      )}
    </section>
  )
}

function OwnerCard({ owner }: { owner: Owner }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground">
          {initials(owner.name)}
        </span>
        <p className="font-medium">{owner.name}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Рабочее время</dt>
        <dd>{`${formatWorkingDays(owner.workingDays)}, ${owner.workdayStart}–${owner.workdayEnd}`}</dd>
        <dt className="text-muted-foreground">Часовой пояс</dt>
        <dd>{owner.timezone}</dd>
      </dl>
      <p className="text-sm">{`Запись открыта на ${formatDays(owner.bookingWindowDays)} вперёд`}</p>
    </div>
  )
}

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-5">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">Запишитесь на звонок</h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Выберите тип встречи, удобный день и свободное время — подтверждение придёт сразу, без переписки и
          согласований.
        </p>
        <Button asChild size="lg" className="h-11 px-6">
          <Link to="/book">
            Записаться
            <ArrowRight />
          </Link>
        </Button>
        <TimeZoneHint />
      </section>

      <section aria-labelledby="how-it-works-heading" className="space-y-4">
        <h2 id="how-it-works-heading" className="text-xl font-semibold tracking-tight">
          Как это работает
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border bg-card p-5 shadow-xs">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground">
                  {index + 1}
                </span>
                <step.icon className="size-4" />
              </div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <OwnerSection />
    </div>
  )
}
