import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: './test/global-setup.ts',
    env: {
      AUTH_SECRET: 'test-auth-secret-do-not-use-in-prod-0000',
      ENCRYPTION_KEY: 'test-encryption-key-do-not-use-in-prod-1111',
      DATABASE_URL: 'file:./test.db',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
