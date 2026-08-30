import mongoose from 'mongoose';

/**
 * A single price entry, e.g. "Phone brought charger" -> 200.
 * `key` is a stable machine-readable identifier used by the charging
 * calculation logic; `label` is what staff see in the UI.
 */
const pricingConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // e.g. PHONE_WITH_CHARGER, PHONE_WITHOUT_CHARGER, DESKTOP,
      // LAPTOP, LAMP, POWERBANK_20000, POWERBANK_30000
    },
    gadgetType: {
      type: String,
      required: [true, 'Gadget type is required'],
      trim: true,
    },
    optionLabel: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Brought charger", "20,000mAh", or "Standard" when the
      // gadget has no sub-option.
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('PricingConfig', pricingConfigSchema);
