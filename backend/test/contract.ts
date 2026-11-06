import { readFileSync } from 'node:fs'
import { Ajv, type ValidateFunction } from 'ajv'
import addFormatsModule from 'ajv-formats'
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify'
import { parse } from 'yaml'

type Schema = Record<string, unknown>
type Operation = {
  operationId: string
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>
}
type OpenApiDocument = {
  paths: Record<string, Record<string, Operation>>
  components: Schema
}

const document = parse(
  readFileSync(new URL('../../api-contract/openapi.yaml', import.meta.url), 'utf8'),
) as OpenApiDocument

const ajv = new Ajv({ strict: false, allErrors: true })
const addFormats = addFormatsModule as unknown as (ajv: Ajv) => Ajv
addFormats(ajv)

const routes = Object.entries(document.paths).map(([template, operations]) => ({
  pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
  operations,
}))

const validators = new Map<string, ValidateFunction>()

function findOperation(method: string, pathname: string): Operation | undefined {
  return routes.find((route) => route.pattern.test(pathname))?.operations[method.toLowerCase()]
}

function validatorFor(key: string, schema: Schema): ValidateFunction {
  let validate = validators.get(key)
  if (!validate) {
    // Local `#/components/...` refs resolve against the schema root.
    validate = ajv.compile({ ...schema, components: document.components })
    validators.set(key, validate)
  }
  return validate
}

/** Validates a response against the operation and status declared in api-contract/openapi.yaml. */
export function assertMatchesContract(method: string, url: string, res: LightMyRequestResponse) {
  const pathname = new URL(url, 'http://localhost').pathname
  const operation = findOperation(method, pathname)
  if (!operation) throw new Error(`No operation in the contract for ${method} ${pathname}`)

  const status = String(res.statusCode)
  const response = operation.responses[status] ?? operation.responses.default
  if (!response) throw new Error(`${operation.operationId} does not declare status ${status}`)

  const schema = response.content?.['application/json']?.schema
  if (!schema) return

  const key = `${operation.operationId} ${status}`
  const validate = validatorFor(key, schema)
  if (!validate(res.json())) {
    throw new Error(`${key} response does not match the contract: ${ajv.errorsText(validate.errors)}\n${res.body}`)
  }
}

/** `app.inject` that fails the test when the response is not described by the contract. */
export async function injectChecked(app: FastifyInstance, options: InjectOptions & { url: string }) {
  const res = await app.inject(options)
  assertMatchesContract(options.method ?? 'GET', options.url, res)
  return res
}
