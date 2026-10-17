import app from './app'
import prisma from './lib/prisma'
import { startExpireReservationsJob } from './jobs/expire-reservations.job'
import { startSendNotificationsJob } from './jobs/send-notifications.job'

const PORT = Number(process.env.PORT ?? 3000)

prisma
  .$connect()
  .then(() => {
    console.log('Database connected')

    startExpireReservationsJob()
    startSendNotificationsJob()

    app.listen(PORT, () => {
      console.log(`MEKAKEL backend running on http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Database connection failed:', error)
    process.exitCode = 1
  })
