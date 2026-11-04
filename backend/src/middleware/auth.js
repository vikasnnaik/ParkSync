const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'parksync_jwt_super_secret_key_college_demo_2026';

/**
 * Middleware to verify JWT token in Authorization header.
 * Supports both ParkSync app JWT tokens and Supabase Auth tokens.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  // 1. Verify internal ParkSync JWT (fastest, covers demo & synced sessions)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.userId) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
        supabaseUid: decoded.supabaseUid || null
      };
      return next();
    }
  } catch (jwtError) {
    // Not an internal JWT or token expired; proceed to try Supabase verification
  }

  // 2. Fallback: Verify with Supabase Auth directly
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        // Find MySQL user by supabase_uid or email
        const [rows] = await pool.execute(
          'SELECT user_id, name, email, role, supabase_uid FROM users WHERE supabase_uid = ? OR email = ?',
          [user.id, user.email]
        );

        if (rows.length > 0) {
          const dbUser = rows[0];
          req.user = {
            userId: dbUser.user_id,
            email: dbUser.email,
            role: dbUser.role,
            name: dbUser.name,
            supabaseUid: user.id
          };
          return next();
        } else {
          // If user exists in Supabase but not yet in MySQL, auto-provision
          const rawName = user.user_metadata?.name || user.email.split('@')[0];
          const role = (user.user_metadata?.role === 'ADMIN' || user.email === 'admin@parksync.com') ? 'ADMIN' : 'DRIVER';
          const [result] = await pool.execute(
            'INSERT INTO users (name, email, supabase_uid, role) VALUES (?, ?, ?, ?)',
            [rawName, user.email, user.id, role]
          );
          req.user = {
            userId: result.insertId,
            email: user.email,
            role,
            name: rawName,
            supabaseUid: user.id
          };
          return next();
        }
      }
    } catch (supabaseError) {
      console.warn('Supabase token verification error:', supabaseError.message);
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid or expired authentication token.'
  });
};

/**
 * Middleware to restrict route access to specific roles
 * @param  {...string} roles Allowed roles, e.g. 'ADMIN'
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' does not have sufficient permissions for this operation.`
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
  JWT_SECRET
};

