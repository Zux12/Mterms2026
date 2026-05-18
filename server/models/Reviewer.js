// server/models/Reviewer.js
const mongoose = require('mongoose');

const ReviewerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  displayName: {
    type: String,
    default: ''
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    default: 'reviewer'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastLoginAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Reviewer', ReviewerSchema);
