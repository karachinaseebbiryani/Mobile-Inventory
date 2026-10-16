export const FEATURE_KEYS = [
  'pos',
  'inventory',
  'imei_tracking',
  'repairs',
  'repair_booking',
  'ecommerce',
  'online_payments',
  'suppliers',
  'purchase_orders',
  'customers',
  'expenses',
  'reports',
  'advanced_reports',
  'multi_branch',
  'staff_management',
  'advanced_permissions',
  'warranties',
  'notifications',
  'custom_domain',
  'byod_database',
  'data_exports',
  'api_access'
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];

export const emptyFeatureSet = (): Record<FeatureKey, boolean> =>
  Object.fromEntries(FEATURE_KEYS.map(key => [key, false])) as Record<FeatureKey, boolean>;
