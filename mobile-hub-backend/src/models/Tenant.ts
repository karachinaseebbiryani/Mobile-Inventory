import mongoose, { Schema } from 'mongoose';
import { FEATURE_KEYS } from '../config/features';

const brandingSchema = new Schema({
  displayName: { type: String, trim: true, maxlength: 120, default: '' },
  logoUrl: { type: String, trim: true, default: '' },
  faviconUrl: { type: String, trim: true, default: '' },
  primaryColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#2563eb' },
  secondaryColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#0f172a' },
  contactEmail: { type: String, trim: true, lowercase: true, default: '' },
  contactPhone: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  openingHours: { type: Schema.Types.Mixed, default: {} },
  receiptFooter: { type: String, trim: true, maxlength: 1000, default: '' },
  storefrontContent: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const businessSettingsSchema = new Schema({
  currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: 'GBP' },
  timeZone: { type: String, default: 'Europe/London' },
  taxRate: { type: Number, min: 0, max: 100, default: 0 },
  allowNegativeStock: { type: Boolean, default: false },
  privacyPolicyUrl: { type: String, default: '' },
  termsUrl: { type: String, default: '' }
}, { _id: false });

const storageSchema = new Schema({
  mode: { type: String, enum: ['managed', 'byod'], default: 'managed', required: true },
  encryptedUri: { type: String, select: false, default: undefined },
  keyVersion: { type: String, select: false, default: undefined },
  databaseName: { type: String, trim: true, default: null },
  connectionStatus: {
    type: String,
    enum: ['not_configured', 'pending', 'connected', 'failed', 'disabled'],
    default: 'not_configured'
  },
  lastHealthCheckAt: { type: Date, default: null }
}, { _id: false });

const featureOverrideSchema = new Schema(
  Object.fromEntries(FEATURE_KEYS.map(key => [key, { type: Boolean, default: undefined }])),
  { _id: false }
);

const limitsSchema = new Schema({
  staff: { type: Number, min: 1, default: 1 },
  branches: { type: Number, min: 1, default: 1 },
  products: { type: Number, min: 1, default: 1000 },
  storageBytes: { type: Number, min: 0, default: 1073741824 }
}, { _id: false });

const tenantSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'rejected', 'archived'],
    default: 'pending',
    required: true
  },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true },
  branding: { type: brandingSchema, default: () => ({}) },
  businessSettings: { type: businessSettingsSchema, default: () => ({}) },
  storage: { type: storageSchema, default: () => ({}) },
  planId: { type: Schema.Types.ObjectId, ref: 'SaasPlan', default: null },
  featureOverrides: { type: featureOverrideSchema, default: () => ({}) },
  limits: { type: limitsSchema, default: () => ({}) },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'SaasUser', default: null }
}, { timestamps: true, minimize: false });

tenantSchema.set('toJSON', {
  transform(_document, result) {
    if (result.storage) {
      delete result.storage.encryptedUri;
      delete result.storage.keyVersion;
    }
    return result;
  }
});
tenantSchema.index({ slug: 1 }, { unique: true });
tenantSchema.index({ status: 1, createdAt: -1 });
tenantSchema.index({ ownerUserId: 1, status: 1 });

export const Tenant = mongoose.model('SaasTenant', tenantSchema);
