import mongoose, { Schema } from 'mongoose';
import { FEATURE_KEYS } from '../config/features';

const planSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  code: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  monthlyPriceMinor: { type: Number, required: true, min: 0 },
  yearlyPriceMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  features: {
    type: new Schema(Object.fromEntries(FEATURE_KEYS.map(key => [key, { type: Boolean, default: false }])), {
      _id: false
    }),
    required: true
  },
  limits: {
    staff: { type: Number, min: 1, default: 1 },
    branches: { type: Number, min: 1, default: 1 },
    products: { type: Number, min: 1, default: 1000 },
    storageBytes: { type: Number, min: 0, default: 1073741824 }
  },
  trialDays: { type: Number, min: 0, max: 90, default: 0 },
  active: { type: Boolean, default: true },
  optionalAddons: { type: [String], default: [] },
  billingProductId: { type: String, trim: true, default: null }
}, { timestamps: true });

planSchema.index({ code: 1 }, { unique: true });
planSchema.index({ active: 1, monthlyPriceMinor: 1 });

export const Plan = mongoose.model('SaasPlan', planSchema);
