import mongoose, { Schema } from 'mongoose';
import { FEATURE_KEYS } from '../config/features';

const subscriptionSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'SaasPlan', required: true },
  provider: { type: String, enum: ['manual', 'stripe'], default: 'manual' },
  providerCustomerId: { type: String, trim: true, default: null },
  providerSubscriptionId: { type: String, trim: true, default: null },
  status: {
    type: String,
    enum: ['pending', 'trialing', 'active', 'past_due', 'canceled', 'expired'],
    default: 'pending',
    required: true
  },
  billingInterval: { type: String, enum: ['month', 'year'], required: true },
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null },
  trialEnd: { type: Date, default: null },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  addOnFeatures: {
    type: new Schema(Object.fromEntries(FEATURE_KEYS.map(key => [key, { type: Boolean, default: false }])), {
      _id: false
    }),
    default: () => ({})
  }
}, { timestamps: true });

subscriptionSchema.index({ tenantId: 1 }, { unique: true });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index(
  { provider: 1, providerSubscriptionId: 1 },
  { unique: true, partialFilterExpression: { providerSubscriptionId: { $type: 'string' } } }
);

export const Subscription = mongoose.model('SaasSubscription', subscriptionSchema);
