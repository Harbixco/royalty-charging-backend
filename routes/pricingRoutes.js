import { Router } from 'express';
import {
  getAllPricing,
  createPricing,
  getPricingById,
  updatePricing,
  deletePricing,
  resetPricingDefaults,
} from '../controllers/pricingController.js';

const router = Router();

router.route('/').get(getAllPricing).post(createPricing);
router.post('/reset', resetPricingDefaults);
router.route('/:id').get(getPricingById).put(updatePricing).delete(deletePricing);

export default router;
