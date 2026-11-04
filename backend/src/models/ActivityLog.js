const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    actorId: {
      type: Number,
      required: false,
      index: true
    },
    actorRole: {
      type: String,
      enum: ['DRIVER', 'ADMIN', 'SYSTEM', 'ANONYMOUS'],
      default: 'SYSTEM'
    },
    actorEmail: {
      type: String,
      default: null
    },
    entityType: {
      type: String,
      required: true,
      index: true // e.g. 'USER', 'RESERVATION', 'SLOT', 'PAYMENT', 'VIOLATION', 'SESSION'
    },
    entityId: {
      type: String,
      required: false
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'activity_logs',
    timestamps: false
  }
);

// Compound index for querying recent logs by actor or entity
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ entityType: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

