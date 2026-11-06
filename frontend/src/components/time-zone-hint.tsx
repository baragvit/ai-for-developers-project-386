import { Globe } from 'lucide-react'
import { localTimeZone } from '@/lib/format'

export function TimeZoneHint() {
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Globe className="size-4" />
      <span>{`Время показано в вашем часовом поясе: ${localTimeZone()}`}</span>
    </p>
  )
}
