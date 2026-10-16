import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as inventoryController from '../controllers/inventory.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', inventoryController.getUnits)
router.post('/', inventoryController.postUnit)

router.get('/summary', inventoryController.getStockSummary)
router.get('/alerts', inventoryController.getExpiryAlertsHandler)

router.get('/:id', inventoryController.getUnit)
router.put('/:id', inventoryController.putUnit)
router.delete('/:id', inventoryController.removeUnit)

export default router
