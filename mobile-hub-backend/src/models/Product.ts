import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface ProductRecord {
  tenantId: Types.ObjectId;
  productCode: string;
  sku: string;
  name: string;
  description: string;
  brand: string;
  itemType: string;
  model: string;
  branch: string;
  category: string;
  color: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  barcode: string | null;
  costPriceMinor: number;
  sellingPriceMinor: number;
  minimumPriceMinor: number;
  quantityOnHand: number;
  showOnPos: boolean;
  firstPurchaseDate: string | null;
  expiryDate: string | null;
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
  productCode: { type: String, trim: true, uppercase: true, maxlength: 64, default: '' },
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  brand: { type: String, trim: true, maxlength: 100, default: '' },
  itemType: { type: String, trim: true, maxlength: 64, default: 'Product' },
  model: { type: String, trim: true, maxlength: 100, default: '' },
  branch: { type: String, trim: true, maxlength: 120, default: 'Main branch' },
  category: { type: String, trim: true, maxlength: 100, default: 'General' },
  color: { type: String, trim: true, maxlength: 64, default: '' },
  supplierName: { type: String, trim: true, maxlength: 120, default: '' },
  supplierInvoiceNumber: { type: String, trim: true, maxlength: 64, default: '' },
  barcode: { type: String, trim: true, default: null },
  costPriceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  sellingPriceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  minimumPriceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, default: 0 },
  quantityOnHand: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, default: 0 },
  showOnPos: { type: Boolean, required: true, default: true },
  firstPurchaseDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  expiryDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  reorderLevel: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, default: 0 },
  status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true, immutable: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true }
}, { timestamps: true, strict: 'throw' });

productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index(
  { tenantId: 1, productCode: 1 },
  { unique: true, partialFilterExpression: { productCode: { $type: 'string', $gt: '' } } }
);
productSchema.index(
  { tenantId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }
);
productSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });
productSchema.index({ tenantId: 1, category: 1, name: 1 });
productSchema.index({ tenantId: 1, itemType: 1, status: 1 });

export const Product: Model<ProductRecord> =
  mongoose.models.SaasProduct as Model<ProductRecord> ||
  mongoose.model<ProductRecord>('SaasProduct', productSchema);
