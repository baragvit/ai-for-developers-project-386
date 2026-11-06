import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = await buildApp({ config, logger: { level: process.env.LOG_LEVEL ?? 'info' } })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}

await app.listen({ host: config.host, port: config.port })
