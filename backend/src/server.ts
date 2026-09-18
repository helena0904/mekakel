import express from 'express'

const app = express()
const PORT = 3000

app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    message: 'MEKAKEL backend is running',
  })
})

app.listen(PORT, () => {
  console.log(`MEKAKEL backend running on http://localhost:${PORT}`)
})