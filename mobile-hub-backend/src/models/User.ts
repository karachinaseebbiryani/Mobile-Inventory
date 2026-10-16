import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  platformRole: { type: String, enum: ['super_admin', 'user'], default: 'user', required: true },
  active: { type: Boolean, default: true, required: true },
  emailVerifiedAt: { type: Date, default: null },
  emailVerificationTokenHash: { type: String, select: false, default: undefined },
  emailVerificationExpiresAt: { type: Date, select: false, default: undefined }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('SaasUser', userSchema);
