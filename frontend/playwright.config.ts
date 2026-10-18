import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:212121@localhost:5432/mekakel_test?schema=public'

const backendDir = path.resolve(__dirname, '..', 'backend')

const backendEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  JWT_SECRET:
    process.env.JWT_SECRET ?? 'e2e-only-secret-not-for-production',
  TRUST_PROXY: '1',
  FRONTEND_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '587',
  SMTP_USER: 'e2e',
  SMTP_PASSWORD: 'e2e',
  SMTP_FROM: 'no-reply@e2e.test',
}

export default defineConfig({
  testDir: './tests',
  globalSetup: path.resolve(__dirname, 'tests/global-setup.ts'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: backendDir,
      env: backendEnv,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
