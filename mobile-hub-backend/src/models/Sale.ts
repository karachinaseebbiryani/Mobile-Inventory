import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface SaleLineRecord {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface SaleRecord {
  tenantId: Types.ObjectId;
  cashierId: Types.ObjectId;
  items: SaleLineRecord[];
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  paymentMethod: 'cash' | 'card' | 'other';
  customerName: string;
  createdAt: Date;
  updatedAt: Date;
}

const saleLineSchema = new Schema<SaleLineRecord>({
  productId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  sku: { type: String, required: true, trim: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  unitPriceMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  lineTotalMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { _id: false, strict: 'throw' });

export const saleSchema = new Schema<SaleRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', required: true, immutable: true },
  cashierId: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true, immutable: true },
  items: { type: [saleLineSchema], required: true, validate: (items: SaleLineRecord[]) => items.length > 0 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  subtotalMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  totalMinor: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  paymentMethod: { type: String, enum: ['cash', 'card', 'other'], required: true },
  customerName: { type: String, trim: true, maxlength: 120, default: '' }
}, { timestamps: true, strict: 'throw' });

saleSchema.index({ tenantId: 1, createdAt: -1 });

export const Sale: Model<SaleRecord> =
  mongoose.models.SaasSale as Model<SaleRecord> ||
  mongoose.model<SaleRecord>('SaasSale', saleSchema);
