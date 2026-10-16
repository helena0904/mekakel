import app from '../../src/app'

// Tests exercise the real application (same routes, middleware, CORS and rate
// limiters as production). Keeping this helper lets suites stay unchanged.
export function createApp() {
  return app
}

export { app }

