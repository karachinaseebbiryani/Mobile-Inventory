import mongoose, { Schema } from 'mongoose';

const signupRequestSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'SaasTenant', required: true },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'SaasUser', required: true },
  shopName: { type: String, required: true, trim: true, maxlength: 120 },
  requestedSlug: { type: String, required: true, trim: true, lowercase: true },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  requestedPlanId: { type: Schema.Types.ObjectId, ref: 'SaasPlan', default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'SaasUser', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

signupRequestSchema.index({ ownerUserId: 1, createdAt: -1 });
signupRequestSchema.index({ status: 1, createdAt: 1 });
signupRequestSchema.index({ requestedSlug: 1, status: 1 });

export const SignupRequest = mongoose.model('SaasSignupRequest', signupRequestSchema);
