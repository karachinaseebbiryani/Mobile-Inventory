import mongoose, { Schema } from 'mongoose';

const domainMappingSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', required: true },
  hostname: { type: String, required: true, trim: true, lowercase: true },
  status: { type: String, enum: ['pending', 'verified', 'disabled'], default: 'pending' },
  verificationTokenHash: { type: String, select: false, default: undefined },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });

domainMappingSchema.index({ hostname: 1 }, { unique: true });
domainMappingSchema.index({ tenantId: 1, status: 1 });

export const DomainMapping = mongoose.model('SaasDomainMapping', domainMappingSchema);
