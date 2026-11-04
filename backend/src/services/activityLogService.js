const ActivityLog = require('../models/ActivityLog');
const { getMongoStatus } = require('../config/mongo');

/**
 * Service to record and query asynchronous system activity logs in MongoDB
 */
class ActivityLogService {
  /**
   * Log an activity to MongoDB collection activity_logs
   */
  static async log({
    action,
    actorId = null,
    actorRole = 'SYSTEM',
    actorEmail = null,
    entityType,
    entityId = null,
    details = {},
    req = null
  }) {
    if (!getMongoStatus()) {
      console.warn(`[ActivityLog Warning] MongoDB not connected; unable to persist activity log: [${action}] for entity [${entityType}:${entityId}]`);
      return null;
    }

    try {
      const ipAddress = req
        ? req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
        : null;

      const logEntry = new ActivityLog({
        action,
        actorId,
        actorRole,
        actorEmail,
        entityType,
        entityId: entityId ? String(entityId) : null,
        details,
        ipAddress,
        timestamp: new Date()
      });

      return await logEntry.save();
    } catch (error) {
      console.error(`[ActivityLog Error] Failed to write log: ${error.message}`);
      return null;
    }
  }

  /**
   * Retrieve paginated activity logs for Admin Dashboard
   */
  static async getLogs({
    entityType,
    action,
    actorRole,
    limit = 50,
    page = 1
  } = {}) {
    if (!getMongoStatus()) {
      return {
        logs: [],
        total: 0,
        mongoOnline: false,
        message: 'MongoDB is currently disconnected or unavailable.'
      };
    }

    try {
      const filter = {};
      if (entityType) filter.entityType = entityType;
      if (action) filter.action = new RegExp(action, 'i');
      if (actorRole) filter.actorRole = actorRole;

      const skip = (Math.max(1, page) - 1) * limit;
      const [logs, total] = await Promise.all([
        ActivityLog.find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ActivityLog.countDocuments(filter)
      ]);

      return {
        logs,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit) || 1,
        mongoOnline: true
      };
    } catch (error) {
      console.error(`[ActivityLog Error] Failed to retrieve logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get log statistics for admin dashboard
   */
  static async getStats() {
    if (!getMongoStatus()) {
      return { totalLogs: 0, topActions: [], mongoOnline: false };
    }

    try {
      const totalLogs = await ActivityLog.countDocuments();
      const topActions = await ActivityLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      return {
        totalLogs,
        topActions,
        mongoOnline: true
      };
    } catch (error) {
      return { totalLogs: 0, topActions: [], mongoOnline: false };
    }
  }
}

module.exports = ActivityLogService;

