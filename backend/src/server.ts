import app from './app'
import prisma from './lib/prisma'

const PORT = Number(process.env.PORT ?? 3000)

prisma
  .$connect()
  .then(() => {
    console.log('Database connected')

    app.listen(PORT, () => {
      console.log(`MEKAKEL backend running on http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Database connection failed:', error)
    process.exitCode = 1
  })
