import { FEATURE_KEYS, type FeatureKey } from '../config/features';

export interface EntitlementInputs {
  tenantStatus: string;
  subscriptionStatus: string;
  currentPeriodEnd?: Date | null;
  planFeatures: Partial<Record<FeatureKey, boolean>>;
  addOnFeatures?: Partial<Record<FeatureKey, boolean>>;
  overrides?: Partial<Record<FeatureKey, boolean | undefined>>;
}

export interface EntitlementResult {
  allowed: boolean;
  reason: 'tenant_inactive' | 'subscription_inactive' | null;
  features: Record<FeatureKey, boolean>;
}

export const resolveEntitlements = (
  input: EntitlementInputs,
  now = new Date()
): EntitlementResult => {
  const tenantActive = input.tenantStatus === 'active';
  const subscriptionActive = ['active', 'trialing'].includes(input.subscriptionStatus) &&
    input.currentPeriodEnd instanceof Date &&
    input.currentPeriodEnd.getTime() > now.getTime();
  const features = Object.fromEntries(FEATURE_KEYS.map(key => {
    const base = input.planFeatures[key] === true || input.addOnFeatures?.[key] === true;
    const override = input.overrides?.[key];
    return [key, typeof override === 'boolean' ? override : base];
  })) as Record<FeatureKey, boolean>;

  if (!tenantActive) return { allowed: false, reason: 'tenant_inactive', features };
  if (!subscriptionActive) return { allowed: false, reason: 'subscription_inactive', features };
  return { allowed: true, reason: null, features };
};
