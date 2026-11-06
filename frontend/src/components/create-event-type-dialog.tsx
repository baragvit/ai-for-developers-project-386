import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateEventType } from '@/api/queries'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SLUG_PATTERN, slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'

const DURATION_PRESETS = [15, 30, 45, 60]

type Values = { name: string; id: string; durationMinutes: string; description: string }
type Errors = Partial<Record<keyof Values, string>>

const emptyValues: Values = { name: '', id: '', durationMinutes: '30', description: '' }

function validate(values: Values): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = 'Укажите название'
  else if (values.name.trim().length > 100) errors.name = 'Не длиннее 100 символов'

  if (values.id.length < 2 || values.id.length > 64) errors.id = 'От 2 до 64 символов'
  else if (!SLUG_PATTERN.test(values.id)) errors.id = 'Только латиница в нижнем регистре, цифры и дефисы'

  const duration = Number(values.durationMinutes)
  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    errors.durationMinutes = 'Целое число от 5 до 240 минут'
  }

  if (values.description.length > 500) errors.description = 'Не длиннее 500 символов'
  return errors
}

export function CreateEventTypeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createEventType = useCreateEventType()
  const [values, setValues] = useState<Values>(emptyValues)
  const [idTouched, setIdTouched] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const reset = () => {
    setValues(emptyValues)
    setIdTouched(false)
    setErrors({})
  }

  const update = (field: keyof Values, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'name' && !idTouched) next.id = slugify(value)
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'name' ? { id: undefined } : {}) }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const clientErrors = validate(values)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    createEventType.mutate(
      {
        id: values.id,
        name: values.name.trim(),
        description: values.description.trim(),
        durationMinutes: Number(values.durationMinutes),
      },
      {
        onSuccess: (created) => {
          toast.success(`Тип встречи «${created.name}» создан`)
          onOpenChange(false)
          reset()
        },
        onError: (error) => {
          if (error.code === 'EVENT_TYPE_ALREADY_EXISTS') {
            setErrors({ id: 'Такой id уже занят — придумайте другой' })
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый тип встречи</DialogTitle>
          <DialogDescription>
            Гости увидят название, описание и длительность на странице записи.
          </DialogDescription>
        </DialogHeader>

        <form id="create-event-type" noValidate onSubmit={handleSubmit} className="space-y-4">
          <FormField id="et-name" label="Название" error={errors.name}>
            <Input
              id="et-name"
              placeholder="Консультация"
              value={values.name}
              aria-invalid={Boolean(errors.name)}
              onChange={(e) => update('name', e.target.value)}
            />
          </FormField>

          <FormField
            id="et-id"
            label="Идентификатор"
            hint="Будет в ссылке: /book/…"
            error={errors.id}
          >
            <Input
              id="et-id"
              className="font-mono"
              placeholder="consultation"
              value={values.id}
              aria-invalid={Boolean(errors.id)}
              onChange={(e) => {
                setIdTouched(true)
                update('id', e.target.value.toLowerCase())
              }}
            />
          </FormField>

          <FormField id="et-duration" label="Длительность, минут" error={errors.durationMinutes}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="et-duration"
                type="number"
                min={5}
                max={240}
                step={5}
                className="w-24"
                value={values.durationMinutes}
                aria-invalid={Boolean(errors.durationMinutes)}
                onChange={(e) => update('durationMinutes', e.target.value)}
              />
              {DURATION_PRESETS.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    String(minutes) === values.durationMinutes &&
                      'border-primary bg-accent text-accent-foreground',
                  )}
                  onClick={() => update('durationMinutes', String(minutes))}
                >
                  {minutes} мин
                </Button>
              ))}
            </div>
          </FormField>

          <FormField id="et-description" label="Описание" hint="Необязательно" error={errors.description}>
            <Textarea
              id="et-description"
              rows={3}
              placeholder="О чём будет встреча и как к ней подготовиться"
              value={values.description}
              aria-invalid={Boolean(errors.description)}
              onChange={(e) => update('description', e.target.value)}
            />
          </FormField>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form="create-event-type" disabled={createEventType.isPending}>
            {createEventType.isPending && <Loader2 className="animate-spin" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}