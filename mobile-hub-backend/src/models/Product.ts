import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface ProductRecord {
  tenantId: Types.ObjectId;
  sku: string;
  name: string;
  description: string;
  brand: string;
  model: string;
  category: string;
  barcode: string | null;
  costPriceMinor: number;
  sellingPriceMinor: number;
  currency: string;
  reorderLevel: number;
  status: 'active' | 'archived';
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const productSchema = new Schema<ProductRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', required: true, immutable: true },
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  brand: { type: String, trim: true, maxlength: 100, default: '' },
  model: { type: String, trim: true, maxlength: 100, default: '' },
  category: { type: String, trim: true, maxlength: 100, default: 'General' },
  barcode: { type: String, trim: true, default: null },
  costPriceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  sellingPriceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  reorderLevel: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, default: 0 },
  status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true, immutable: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true }
}, { timestamps: true, strict: 'throw' });

productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index(
  { tenantId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }
);
productSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });
productSchema.index({ tenantId: 1, category: 1, name: 1 });

export const Product: Model<ProductRecord> =
  mongoose.models.SaasProduct as Model<ProductRecord> ||
  mongoose.model<ProductRecord>('SaasProduct', productSchema);
