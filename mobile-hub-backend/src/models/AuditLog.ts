import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema({
  actorUserId: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', default: null },
  action: { type: String, required: true, trim: true, maxlength: 120 },
  targetType: { type: String, required: true, trim: true, maxlength: 80 },
  targetId: { type: String, required: true, trim: true, maxlength: 100 },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('SaasAuditLog', auditLogSchema);
