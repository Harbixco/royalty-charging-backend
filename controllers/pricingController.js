import PricingConfig from '../models/PricingConfig.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { DEFAULT_PRICING } from '../utils/defaultPricing.js';

// GET /api/pricing
export const getAllPricing = asyncHandler(async (req, res) => {
  let pricing = await PricingConfig.find().sort({ gadgetType: 1, price: 1 });

  // If empty or missing some default items, auto-seed defaults
  if (!pricing || pricing.length === 0) {
    await PricingConfig.insertMany(DEFAULT_PRICING);
    pricing = await PricingConfig.find().sort({ gadgetType: 1, price: 1 });
  } else {
    // Check if any default gadget keys are missing and insert them
    const existingKeys = new Set(pricing.map((p) => p.key));
    const missing = DEFAULT_PRICING.filter((dp) => !existingKeys.has(dp.key));
    if (missing.length > 0) {
      await PricingConfig.insertMany(missing);
      pricing = await PricingConfig.find().sort({ gadgetType: 1, price: 1 });
    }
  }

  res.status(200).json(new ApiResponse(200, pricing, 'Pricing list retrieved'));
});

// POST /api/pricing/reset
export const resetPricingDefaults = asyncHandler(async (req, res) => {
  for (const item of DEFAULT_PRICING) {
    await PricingConfig.findOneAndUpdate(
      { key: item.key },
      { $set: { optionLabel: item.optionLabel, price: item.price, active: true } },
      { upsert: true, new: true }
    );
  }
  const pricing = await PricingConfig.find().sort({ gadgetType: 1, price: 1 });
  res.status(200).json(new ApiResponse(200, pricing, 'Pricing reset to default values'));
});

// POST /api/pricing
// Admin can create a new gadget and pricing option
export const createPricing = asyncHandler(async (req, res) => {
  let { gadgetType, optionLabel, price, key } = req.body;

  if (!gadgetType || !gadgetType.trim()) {
    throw new ApiError(400, 'Gadget name/type is required');
  }

  const cleanGadgetType = gadgetType.trim();
  const cleanOptionLabel = optionLabel?.trim() || 'Standard';

  if (price === undefined || typeof price !== 'number' || price < 0) {
    throw new ApiError(400, 'A valid non-negative price is required');
  }

  // Generate a clean key if none provided
  if (!key || !key.trim()) {
    const rawKey = `${cleanGadgetType}_${cleanOptionLabel}`
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    key = rawKey;
  } else {
    key = key.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  }

  // Ensure key uniqueness
  let finalKey = key;
  let suffix = 1;
  while (await PricingConfig.findOne({ key: finalKey })) {
    suffix += 1;
    finalKey = `${key}_${suffix}`;
  }

  const newItem = await PricingConfig.create({
    key: finalKey,
    gadgetType: cleanGadgetType,
    optionLabel: cleanOptionLabel,
    price,
    active: true,
  });

  res.status(201).json(new ApiResponse(201, newItem, `New gadget "${cleanGadgetType}" created successfully`));
});

// GET /api/pricing/:id
export const getPricingById = asyncHandler(async (req, res) => {
  const item = await PricingConfig.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Pricing entry not found');
  res.status(200).json(new ApiResponse(200, item, 'Pricing entry retrieved'));
});

// PUT /api/pricing/:id
export const updatePricing = asyncHandler(async (req, res) => {
  const { price, active, optionLabel } = req.body;

  if (price === undefined && active === undefined && optionLabel === undefined) {
    throw new ApiError(400, 'Provide at least a price, active flag, or optionLabel to update');
  }

  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    throw new ApiError(400, 'Price must be a non-negative number');
  }

  const item = await PricingConfig.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Pricing entry not found');

  if (price !== undefined) item.price = price;
  if (active !== undefined) item.active = active;
  if (optionLabel !== undefined && optionLabel.trim()) item.optionLabel = optionLabel.trim();
  await item.save();

  res.status(200).json(new ApiResponse(200, item, 'Pricing updated successfully'));
});

// DELETE /api/pricing/:id
export const deletePricing = asyncHandler(async (req, res) => {
  const item = await PricingConfig.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Pricing entry not found');
  res.status(200).json(new ApiResponse(200, { id: req.params.id }, 'Pricing entry removed'));
});
