export const fieldErrorId = (id: string) => `${id}-error`

/** Spread on the input inside a `FormField` with the same `id` so its error is the input's description. */
export const errorProps = (id: string, error: string | undefined) => ({
  'aria-invalid': Boolean(error),
  'aria-describedby': error ? fieldErrorId(id) : undefined,
})
