// server/models/PasswordReset.js
const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true, index: true },
    email: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },

    // optional audit fields
    ip: { type: String, default: '' },
    ua: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
