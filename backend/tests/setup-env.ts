import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import * as dotenv from 'dotenv'

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.test'),
  override: true,
})

// `upload.middleware.ts` derives its storage directory from process.cwd().
// Run in a throwaway directory so tests never write into the real
// backend/private-uploads folder.
const testWorkDir = path.join(os.tmpdir(), 'mekakel-test-workdir')
fs.mkdirSync(testWorkDir, { recursive: true })
process.chdir(testWorkDir)

const databaseUrl = process.env.DATABASE_URL ?? ''

if (!/mekakel_test(\?|$)/.test(databaseUrl)) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point to the dedicated ' +
      'mekakel_test database. Refusing to touch any other database.'
  )
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-secret-not-for-production'
}

// Rate limiters key off req.ip; trust one proxy hop so each test can send a
// unique X-Forwarded-For value without tripping shared counters.
if (!process.env.TRUST_PROXY) {
  process.env.TRUST_PROXY = '1'
}

if (!process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS =
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
}
