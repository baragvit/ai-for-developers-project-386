import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '../api-contract/openapi.yaml',
  output: { path: 'src/api/model/zod', importFileExtension: '.js' },
  plugins: [
    {
      name: 'zod',
      dates: { offset: true },
      responses: false,
    },
  ],
})
