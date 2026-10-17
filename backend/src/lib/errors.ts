export class AppError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
  }
}

export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (error instanceof Error &&
      error.name === 'AppError' &&
      typeof (error as AppError).statusCode === 'number')
  )
}
