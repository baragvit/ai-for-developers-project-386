import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 7399)
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Production build of the whole app: backend serves the API and the built frontend.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm start',
        cwd: '..',
        url: `${baseURL}/api/owner`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          PORT: String(PORT),
          HOST: '127.0.0.1',
          OWNER_TIMEZONE: 'Europe/Moscow',
          WORKING_DAYS: '1,2,3,4,5,6,7',
          SEED_DEMO_DATA: 'true',
          LOG_LEVEL: 'warn',
        },
      },
})
