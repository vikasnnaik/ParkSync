const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const supabase = require('../config/supabase');
const { JWT_SECRET } = require('../middleware/auth');
const ActivityLogService = require('../services/activityLogService');

/**
 * Register a new user (DRIVER or ADMIN)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role = 'DRIVER' } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, and password are required.'
      });
    }

    const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'DRIVER';

    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT user_id, email, phone FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email or phone number already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, passwordHash, assignedRole]
    );

    const userId = result.insertId;

    // Generate JWT
    const token = jwt.sign(
      { userId, email, role: assignedRole, name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Activity Log
    ActivityLogService.log({
      action: 'User registered',
      actorId: userId,
      actorRole: assignedRole,
      actorEmail: email,
      entityType: 'USER',
      entityId: userId,
      details: { name, email, role: assignedRole },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: {
        userId,
        name,
        email,
        phone,
        role: assignedRole
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const [users] = await pool.execute(
      'SELECT user_id, name, email, phone, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];

    // Verify password with bcrypt, and fallback to plain match in case of pre-populated plain text in DB
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } catch (e) {
      isMatch = false;
    }

    if (!isMatch && user.password_hash === password) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Activity Log
    ActivityLogService.log({
      action: 'User login',
      actorId: user.user_id,
      actorRole: user.role,
      actorEmail: user.email,
      entityType: 'USER',
      entityId: user.user_id,
      details: { role: user.role },
      req
    });

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current profile
 */
const getProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT user_id, name, email, phone, role, created_at FROM users WHERE user_id = ?',
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      user: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Synchronize Supabase Authenticated User with MySQL Database
 */
const syncSupabaseUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Supabase is not configured on the backend.'
      });
    }

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Supabase authentication token.'
      });
    }

    // Check if email is verified
    const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
    if (!isEmailConfirmed) {
      return res.status(403).json({
        success: false,
        isVerified: false,
        message: 'Email verification is pending. Please verify the OTP sent to your email.'
      });
    }

    const email = user.email;
    const supabaseUid = user.id;
    const rawName = user.user_metadata?.name || user.user_metadata?.full_name || req.body.name || email.split('@')[0];
    const role = (user.user_metadata?.role === 'ADMIN' || email === 'admin@parksync.com') ? 'ADMIN' : 'DRIVER';

    // Find in MySQL users
    const [existingUsers] = await pool.execute(
      'SELECT user_id, name, email, phone, role, supabase_uid FROM users WHERE supabase_uid = ? OR email = ?',
      [supabaseUid, email]
    );

    let dbUser;
    if (existingUsers.length > 0) {
      dbUser = existingUsers[0];
      // Update supabase_uid or name if needed
      if (!dbUser.supabase_uid || (rawName && dbUser.name !== rawName)) {
        await pool.execute(
          'UPDATE users SET supabase_uid = COALESCE(?, supabase_uid), name = COALESCE(?, name) WHERE user_id = ?',
          [supabaseUid, rawName, dbUser.user_id]
        );
        dbUser.supabase_uid = supabaseUid;
        if (rawName) dbUser.name = rawName;
      }
    } else {
      // Create user in MySQL
      const [insertResult] = await pool.execute(
        'INSERT INTO users (name, email, supabase_uid, role) VALUES (?, ?, ?, ?)',
        [rawName, email, supabaseUid, role]
      );
      dbUser = {
        user_id: insertResult.insertId,
        name: rawName,
        email,
        phone: null,
        role,
        supabase_uid: supabaseUid
      };
    }

    // Generate internal JWT for session persistence & fast backend access
    const appToken = jwt.sign(
      {
        userId: dbUser.user_id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
        supabaseUid
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // MongoDB Activity Log
    ActivityLogService.log({
      action: 'Supabase User Verified & Synced',
      actorId: dbUser.user_id,
      actorRole: dbUser.role,
      actorEmail: dbUser.email,
      entityType: 'USER',
      entityId: dbUser.user_id,
      details: { supabaseUid, email: dbUser.email, role: dbUser.role },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'User synchronized successfully.',
      token: appToken,
      supabaseToken: token,
      user: {
        userId: dbUser.user_id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: dbUser.role,
        supabaseUid
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  syncSupabaseUser
};

