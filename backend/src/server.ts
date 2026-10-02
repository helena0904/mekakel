import cors from 'cors'
import express from 'express'
import prisma from './lib/prisma'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)

app.get('/', (_req, res) => {
  res.json({
    message: 'MEKAKEL backend is running',
  })
})

prisma.$connect()
  .then(() => {
    console.log('Database connected')

    app.listen(PORT, () => {
      console.log(`MEKAKEL backend running on http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Database connection failed:', error)
  })