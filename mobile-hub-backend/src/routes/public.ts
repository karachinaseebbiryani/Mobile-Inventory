import { Router } from 'express';
import { Plan } from '../models/Plan';
import { asyncHandler } from '../utils/http';

export const createPublicRouter = (): Router => {
  const router = Router();
  router.get('/plans', asyncHandler(async (_request, response) => {
    const plans = await Plan.find({ active: true })
      .select('name code description monthlyPriceMinor yearlyPriceMinor currency features limits trialDays optionalAddons')
      .sort({ monthlyPriceMinor: 1 })
      .lean();
    response.json({ data: plans });
  }));
  return router;
};
