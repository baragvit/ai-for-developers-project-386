import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { installFetchMock, resetApi } from './api'

// The API client captures `fetch` when its module loads, so the mock must be in place before any test imports it.
installFetchMock()

afterEach(() => {
  cleanup()
  resetApi()
})
