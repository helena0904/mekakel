import { Router } from 'express'
import { verifyFayda } from '../controllers/fayda.controller'

const router = Router()

router.post('/verify', verifyFayda)

export default router