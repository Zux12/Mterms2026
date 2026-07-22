const mongoose = require('mongoose');

const PageVisitSchema = new mongoose.Schema({
  path: { type: String, required: true, trim: true, maxlength: 300 },
  title: { type: String, trim: true, maxlength: 300, default: '' },
  enteredAt: { type: Date, required: true },
  lastActivityAt: { type: Date, required: true },
  durationSeconds: { type: Number, default: 0, min: 0 },
  views: { type: Number, default: 1, min: 1 }
}, { _id: false });

const AnalyticsSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  visitorIdHash: { type: String, required: true, index: true },

  countryCode: { type: String, trim: true, uppercase: true, maxlength: 3, default: 'XX', index: true },
  country: { type: String, trim: true, maxlength: 100, default: 'Unknown', index: true },

  deviceType: { type: String, enum: ['Desktop', 'Mobile', 'Tablet', 'Other'], default: 'Other', index: true },
  browser: { type: String, trim: true, maxlength: 80, default: 'Unknown', index: true },
  operatingSystem: { type: String, trim: true, maxlength: 80, default: 'Unknown', index: true },
  language: { type: String, trim: true, maxlength: 30, default: '' },
  screenWidth: { type: Number, default: 0, min: 0 },
  screenHeight: { type: Number, default: 0, min: 0 },

  landingPage: { type: String, trim: true, maxlength: 300, default: '' },
  lastPage: { type: String, trim: true, maxlength: 300, default: '' },
  totalPageViews: { type: Number, default: 0, min: 0 },
  durationSeconds: { type: Number, default: 0, min: 0 },

  pages: { type: [PageVisitSchema], default: [] },

  startedAt: { type: Date, required: true, index: true },
  lastActivityAt: { type: Date, required: true, index: true },
  endedAt: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'analytics_sessions'
});

AnalyticsSessionSchema.index({ startedAt: -1 });
AnalyticsSessionSchema.index({ visitorIdHash: 1, startedAt: -1 });
AnalyticsSessionSchema.index({ country: 1, startedAt: -1 });

module.exports = mongoose.models.AnalyticsSession ||
  mongoose.model('AnalyticsSession', AnalyticsSessionSchema);
