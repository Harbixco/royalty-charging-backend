import mongoose from 'mongoose';

const GADGET_TYPES = ['Phone', 'Desktop', 'Laptop', 'Lamp', 'Power Bank'];
const STATUSES = ['Pending', 'Charging', 'Completed'];

const chargingRecordSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: [2, 'Customer name must be at least 2 characters'],
      maxlength: 100,
    },
    tagNumber: {
      type: String,
      required: [true, 'Tag number is required'],
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    gadgetType: {
      type: String,
      required: [true, 'Gadget type is required'],
    },
    // Machine-readable pricing key this record was charged against,
    // e.g. PHONE_WITH_CHARGER or POWERBANK_30000. Lets us recompute
    // display labels without re-deriving them from free text.
    pricingKey: {
      type: String,
      required: true,
    },
    // Human-readable option/capacity shown in tables & details,
    // e.g. "With Charger" or "20,000mAh".
    option: {
      type: String,
      required: true,
      trim: true,
    },
    // List of itemized gadgets if multiple were selected in one session
    items: [
      {
        gadgetType: { type: String, required: true },
        pricingKey: { type: String, required: true },
        option: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    // Snapshot of the price at the moment this record was created.
    // Intentionally NOT derived from PricingConfig on read, so that
    // later price changes never alter historical records.
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'Charging',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent two ACTIVE (Pending/Charging) records from sharing a tag
// number, while still allowing a tag to be reused once its previous
// gadget has been collected (status = Completed).
chargingRecordSchema.index(
  { tagNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Pending', 'Charging'] } },
  }
);

chargingRecordSchema.index({ customerName: 'text' });
chargingRecordSchema.index({ createdAt: -1 });

chargingRecordSchema.pre('save', function setCompletedAt(next) {
  if (this.isModified('status')) {
    if (this.status === 'Completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
    if (this.status !== 'Completed') {
      this.completedAt = null;
    }
  }
  next();
});

export const GADGET_TYPE_VALUES = GADGET_TYPES;
export const STATUS_VALUES = STATUSES;

export default mongoose.model('ChargingRecord', chargingRecordSchema);
