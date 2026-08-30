import { Router } from 'express';
import {
  createChargingRecord,
  getChargingRecords,
  getChargingRecordById,
  lookupByTagNumber,
  getNextTag,
  updateChargingRecord,
  updateChargingStatus,
  completeChargingRecord,
  updatePaymentStatus,
  deleteChargingRecord,
} from '../controllers/chargingController.js';

const router = Router();

// Specific static/param routes must come before the generic /:id route
router.get('/next-tag', getNextTag);
router.get('/lookup/:tagNumber', lookupByTagNumber);

router.route('/').post(createChargingRecord).get(getChargingRecords);

router
  .route('/:id')
  .get(getChargingRecordById)
  .put(updateChargingRecord)
  .delete(deleteChargingRecord);

router.patch('/:id/status', updateChargingStatus);
router.patch('/:id/complete', completeChargingRecord);
router.patch('/:id/payment', updatePaymentStatus);

export default router;
