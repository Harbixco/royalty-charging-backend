import ChargingRecord from '../models/ChargingRecord.js';
import PricingConfig from '../models/PricingConfig.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { buildChargingFilter, getPagination } from '../utils/queryHelpers.js';

// Helper to determine the next sequential tag number (e.g. ROY-001 -> ROY-002)
export const getNextAvailableTag = async () => {
  const records = await ChargingRecord.find({}, 'tagNumber status').lean();

  let maxNum = 0;
  const activeTags = new Set();

  for (const r of records) {
    if (!r.tagNumber) continue;
    if (['Pending', 'Charging'].includes(r.status)) {
      activeTags.add(r.tagNumber.toUpperCase());
    }
    const match = r.tagNumber.match(/^(?:ROY|TAG)-?(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `ROY-${String(nextNum).padStart(3, '0')}`;

  // Ensure candidate tag is not currently active
  while (activeTags.has(candidate)) {
    nextNum += 1;
    candidate = `ROY-${String(nextNum).padStart(3, '0')}`;
  }

  return candidate;
};

// GET /api/charging/next-tag
export const getNextTag = asyncHandler(async (req, res) => {
  const nextTag = await getNextAvailableTag();
  res.status(200).json(new ApiResponse(200, { tagNumber: nextTag }, 'Next tag generated'));
});

// POST /api/charging
// Amount is NEVER accepted from the client — it is always derived
// server-side from active PricingConfig entries matching pricingKey / items.
export const createChargingRecord = asyncHandler(async (req, res) => {
  const { customerName, tagNumber, pricingKey, items, notes, paymentStatus } = req.body;

  if (!customerName || !customerName.trim()) {
    throw new ApiError(400, 'Customer name is required');
  }

  if (!tagNumber || !tagNumber.trim()) {
    throw new ApiError(400, 'Tag number is required');
  }

  const normalizedTag = tagNumber.trim().toUpperCase();

  const existingActive = await ChargingRecord.findOne({
    tagNumber: normalizedTag,
    status: { $in: ['Pending', 'Charging'] },
  });
  if (existingActive) {
    throw new ApiError(
      409,
      `Tag number ${normalizedTag} already has an active charging record. ` +
        'Mark it as completed before reusing this tag.'
    );
  }

  let resolvedItems = [];
  let totalAmount = 0;
  let primaryGadgetType = '';
  let primaryOption = '';
  let primaryPricingKey = '';

  if (Array.isArray(items) && items.length > 0) {
    // Multi-gadget mode
    const pricingKeys = items.map((it) => it.pricingKey).filter(Boolean);
    if (pricingKeys.length === 0) {
      throw new ApiError(400, 'Please select at least one gadget option');
    }

    const pricingDocs = await PricingConfig.find({ key: { $in: pricingKeys }, active: true });
    const pricingMap = new Map(pricingDocs.map((p) => [p.key, p]));

    for (const it of items) {
      if (!it.pricingKey) continue;
      const pricing = pricingMap.get(it.pricingKey);
      if (!pricing) {
        throw new ApiError(400, `Selected gadget option "${it.pricingKey}" is invalid or inactive`);
      }
      resolvedItems.push({
        gadgetType: pricing.gadgetType,
        pricingKey: pricing.key,
        option: pricing.optionLabel,
        amount: pricing.price,
        charged: true,
      });
      totalAmount += pricing.price;
    }

    if (resolvedItems.length === 0) {
      throw new ApiError(400, 'Please select at least one valid gadget');
    }

    const uniqueGadgets = [...new Set(resolvedItems.map((i) => i.gadgetType))];
    primaryGadgetType = uniqueGadgets.join(', ');
    primaryOption = resolvedItems.map((i) => `${i.gadgetType} (${i.option})`).join(', ');
    primaryPricingKey = resolvedItems.map((i) => i.pricingKey).join(',');
  } else {
    // Single gadget fallback mode
    if (!pricingKey) {
      throw new ApiError(400, 'A gadget/option (pricingKey) must be selected');
    }

    const pricing = await PricingConfig.findOne({ key: pricingKey, active: true });
    if (!pricing) {
      throw new ApiError(400, 'The selected gadget/option is not a valid, active price');
    }

    resolvedItems = [
      {
        gadgetType: pricing.gadgetType,
        pricingKey: pricing.key,
        option: pricing.optionLabel,
        amount: pricing.price,
        charged: true,
      },
    ];
    totalAmount = pricing.price;
    primaryGadgetType = pricing.gadgetType;
    primaryOption = pricing.optionLabel;
    primaryPricingKey = pricing.key;
  }

  const isPaid = paymentStatus === 'Paid';

  const record = await ChargingRecord.create({
    customerName: customerName.trim(),
    tagNumber: normalizedTag,
    gadgetType: primaryGadgetType,
    pricingKey: primaryPricingKey,
    option: primaryOption,
    items: resolvedItems,
    originalAmount: totalAmount,
    amount: totalAmount, // snapshot at creation time
    paymentStatus: isPaid ? 'Paid' : 'Unpaid',
    paidAt: isPaid ? new Date() : null,
    status: 'Charging',
    notes,
  });

  res.status(201).json(new ApiResponse(201, record, 'Charging record created successfully'));
});

// GET /api/charging
export const getChargingRecords = asyncHandler(async (req, res) => {
  const filter = buildChargingFilter(req.query);
  const { page, limit, skip } = getPagination(req.query);

  const [records, total] = await Promise.all([
    ChargingRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ChargingRecord.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
      'Charging records retrieved'
    )
  );
});

// GET /api/charging/:id
export const getChargingRecordById = asyncHandler(async (req, res) => {
  const record = await ChargingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Charging record not found');
  res.status(200).json(new ApiResponse(200, record, 'Charging record retrieved'));
});

// GET /api/charging/lookup/:tagNumber
// Fast lookup used by the "Find Customer by Tag Number" widget.
// Prefers an active (Pending/Charging) record, falls back to the most
// recent record for that tag so staff always get a useful result.
export const lookupByTagNumber = asyncHandler(async (req, res) => {
  const tag = req.params.tagNumber.trim().toUpperCase();

  let record = await ChargingRecord.findOne({
    tagNumber: tag,
    status: { $in: ['Pending', 'Charging'] },
  }).sort({ createdAt: -1 });

  if (!record) {
    record = await ChargingRecord.findOne({ tagNumber: tag }).sort({ createdAt: -1 });
  }

  if (!record) throw new ApiError(404, `No charging record found for tag ${tag}`);

  res.status(200).json(new ApiResponse(200, record, 'Record found'));
});

// PUT /api/charging/:id
// Editable fields are limited to customerName, tagNumber and notes.
// Gadget/option/amount are intentionally NOT editable here — if staff
// picked the wrong gadget, the cleanest fix is delete + re-create so
// the amount always stays consistent with a real pricing entry.
export const updateChargingRecord = asyncHandler(async (req, res) => {
  const { customerName, tagNumber, notes } = req.body;
  const record = await ChargingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Charging record not found');

  if (customerName !== undefined) {
    if (!customerName.trim()) throw new ApiError(400, 'Customer name cannot be empty');
    record.customerName = customerName.trim();
  }

  if (tagNumber !== undefined) {
    const normalizedTag = tagNumber.trim().toUpperCase();
    if (!normalizedTag) throw new ApiError(400, 'Tag number cannot be empty');

    if (normalizedTag !== record.tagNumber && ['Pending', 'Charging'].includes(record.status)) {
      const clash = await ChargingRecord.findOne({
        tagNumber: normalizedTag,
        status: { $in: ['Pending', 'Charging'] },
        _id: { $ne: record._id },
      });
      if (clash) throw new ApiError(409, `Tag number ${normalizedTag} is already active`);
    }
    record.tagNumber = normalizedTag;
  }

  if (notes !== undefined) record.notes = notes;

  await record.save();
  res.status(200).json(new ApiResponse(200, record, 'Charging record updated successfully'));
});

// PATCH /api/charging/:id/status
export const updateChargingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['Pending', 'Charging', 'Completed'];

  if (!status || !allowed.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${allowed.join(', ')}`);
  }

  const record = await ChargingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Charging record not found');

  record.status = status;
  await record.save();

  res.status(200).json(new ApiResponse(200, record, `Record marked as ${status}`));
});

// PATCH /api/charging/:id/complete
// Completes charging session, allows marking individual gadgets as charged or not charged,
// recalculates record.amount to subtract uncharged gadgets from total income, and sets paymentStatus.
export const completeChargingRecord = asyncHandler(async (req, res) => {
  const { items: itemUpdates, paymentStatus } = req.body;
  const record = await ChargingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Charging record not found');

  if (Array.isArray(itemUpdates) && record.items && record.items.length > 0) {
    const updatedItems = record.items.map((item, idx) => {
      const update = itemUpdates.find(
        (u) =>
          u.index === idx ||
          (u._id && String(u._id) === String(item._id)) ||
          (u.pricingKey && u.pricingKey === item.pricingKey && (!u.option || u.option === item.option))
      );
      const isCharged = update !== undefined && update.charged !== undefined
        ? Boolean(update.charged)
        : item.charged !== false;
      return {
        _id: item._id,
        gadgetType: item.gadgetType,
        pricingKey: item.pricingKey,
        option: item.option,
        amount: item.amount,
        charged: isCharged,
      };
    });

    record.items = updatedItems;
    // Calculate new total amount based only on charged gadgets
    const chargedAmount = updatedItems
      .filter((it) => it.charged)
      .reduce((sum, it) => sum + (it.amount || 0), 0);

    record.amount = chargedAmount;
  }

  if (paymentStatus && ['Paid', 'Unpaid'].includes(paymentStatus)) {
    record.paymentStatus = paymentStatus;
    if (paymentStatus === 'Paid' && !record.paidAt) {
      record.paidAt = new Date();
    } else if (paymentStatus === 'Unpaid') {
      record.paidAt = null;
    }
  }

  record.status = 'Completed';
  record.completedAt = new Date();
  await record.save();

  res.status(200).json(new ApiResponse(200, record, 'Charging session completed and revenue updated'));
});

// PATCH /api/charging/:id/payment
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!paymentStatus || !['Paid', 'Unpaid'].includes(paymentStatus)) {
    throw new ApiError(400, 'Payment status must be "Paid" or "Unpaid"');
  }

  const record = await ChargingRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Charging record not found');

  record.paymentStatus = paymentStatus;
  record.paidAt = paymentStatus === 'Paid' ? new Date() : null;
  await record.save();

  res.status(200).json(new ApiResponse(200, record, `Payment marked as ${paymentStatus}`));
});

// DELETE /api/charging/:id
export const deleteChargingRecord = asyncHandler(async (req, res) => {
  const record = await ChargingRecord.findByIdAndDelete(req.params.id);
  if (!record) throw new ApiError(404, 'Charging record not found');
  res.status(200).json(new ApiResponse(200, { id: req.params.id }, 'Charging record deleted'));
});
