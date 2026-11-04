const ActivityLogService = require('../services/activityLogService');

/**
 * Get MongoDB activity logs (Admin only)
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const { entityType, action, actorRole, limit = 50, page = 1 } = req.query;

    const data = await ActivityLogService.getLogs({
      entityType,
      action,
      actorRole,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10)
    });

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get activity log summary stats
 */
const getActivityStats = async (req, res, next) => {
  try {
    const stats = await ActivityLogService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivityLogs,
  getActivityStats
};

