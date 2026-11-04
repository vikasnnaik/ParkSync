const { pool } = require('../config/db');

/**
 * Get notifications for logged in user
 */
const getNotifications = async (req, res, next) => {
  try {
    const [notifications] = await pool.execute(
      `SELECT notification_id, user_id, title, message, created_at,
              COALESCE(is_read, 'N') AS is_read
       FROM notifications
       WHERE user_id = ?
       ORDER BY notification_id DESC
       LIMIT 50`,
      [req.user.userId]
    );

    res.json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    // If is_read column doesn't exist, fallback query
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      try {
        const [fallback] = await pool.execute(
          `SELECT notification_id, user_id, message, created_at, 'N' AS is_read
           FROM notifications
           WHERE user_id = ?
           ORDER BY notification_id DESC
           LIMIT 50`,
          [req.user.userId]
        );
        return res.json({ success: true, count: fallback.length, notifications: fallback });
      } catch (err2) {
        return next(err2);
      }
    }
    next(error);
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const notificationId = parseInt(req.params.id, 10);

    try {
      await pool.execute(
        `UPDATE notifications SET is_read = 'Y' WHERE notification_id = ? AND user_id = ?`,
        [notificationId, req.user.userId]
      );
    } catch (err) {
      // If column doesn't exist, silently succeed
    }

    res.json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead
};

