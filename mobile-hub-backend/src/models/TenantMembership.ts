import mongoose, { Schema } from 'mongoose';

const tenantMembershipSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', required: true, immutable: true },
  userId: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true, immutable: true },
  role: {
    type: String,
    enum: ['owner', 'admin', 'manager', 'cashier', 'technician', 'inventory_manager'],
    default: 'owner',
    required: true
  },
  permissions: { type: [String], default: [] },
  status: { type: String, enum: ['pending_approval', 'active', 'revoked'], default: 'pending_approval' }
}, { timestamps: true });

tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
tenantMembershipSchema.index({ userId: 1, status: 1 });

export const TenantMembership = mongoose.model('SaasTenantMembership', tenantMembershipSchema);
