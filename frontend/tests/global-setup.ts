import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Prepares the end-to-end database before the suite runs. The backend server
 * (started by the Playwright `webServer` config) points at the same
 * DATABASE_URL, so migrations and the deterministic seed must be applied
 * first when the database is fresh.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env.E2E_DATABASE_URL ??
    'postgresql://postgres:212121@localhost:5432/mekakel_test?schema=public'

  const backendDir = path.resolve(__dirname, '..', '..', 'backend')
  const env = { ...process.env, DATABASE_URL: databaseUrl }

  execSync('npx prisma migrate deploy', {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  })

  execSync('npm run e2e:reset', {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  })
}
