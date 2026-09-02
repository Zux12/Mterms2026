const mongoose = require('mongoose');

const MtermsLiveAnnouncementSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },

  important: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  publishedAt: {
    type: Date,
    default: Date.now,
    index: true
  }

}, {
  timestamps: true,
  collection: 'mtermslive_announcements'
});

MtermsLiveAnnouncementSchema.index({
  publishedAt: -1
});

module.exports =
  mongoose.models.MtermsLiveAnnouncement ||
  mongoose.model(
    'MtermsLiveAnnouncement',
    MtermsLiveAnnouncementSchema
  );
