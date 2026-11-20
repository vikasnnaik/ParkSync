'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage on client mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = typeof window !== 'undefined' ? localStorage.getItem('parksync_token') : null;
        const savedUser = typeof window !== 'undefined' ? localStorage.getItem('parksync_user') : null;

        if (savedToken) {
          setToken(savedToken);
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch {
              // ignore json parse error
            }
          }

          try {
            const res = await authApi.getProfile();
            if (res.success && res.user) {
              setUser(res.user);
              if (typeof window !== 'undefined') {
                localStorage.setItem('parksync_user', JSON.stringify(res.user));
              }
            }
          } catch (error) {
            console.warn('Profile fetch failed, clearing stale auth session');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('parksync_token');
              localStorage.removeItem('parksync_user');
            }
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Unified Login:
   * 1. Attempt Supabase Auth signInWithPassword
   * 2. If unconfirmed email -> throw with isUnverified flag
   * 3. If Supabase succeeds -> sync with MySQL backend
   * 4. If Supabase fails (e.g. demo credentials not in Supabase yet) -> fallback to existing backend login
   */
  const login = async (email, password) => {
    // 1. Try Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // If email not verified, explicitly flag for OTP verification screen
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('email not verified')
        ) {
          const unverifiedErr = new Error('Email verification is pending. Please verify the OTP sent to your email.');
          unverifiedErr.isUnverified = true;
          unverifiedErr.email = email.trim();
          throw unverifiedErr;
        }

        // If credentials invalid in Supabase, fall through to demo / backend login check
      } else if (data?.session?.access_token) {
        // Supabase login success -> sync with backend to get MySQL user & app token
        const syncRes = await authApi.sync(
          { name: data.user.user_metadata?.name },
          data.session.access_token
        );

        if (syncRes.success && syncRes.token) {
          setToken(syncRes.token);
          setUser(syncRes.user);
          localStorage.setItem('parksync_token', syncRes.token);
          localStorage.setItem('parksync_user', JSON.stringify(syncRes.user));
          localStorage.setItem('parksync_supabase_token', data.session.access_token);
          return syncRes;
        }
      }
    } catch (sbError) {
      if (sbError.isUnverified) {
        throw sbError;
      }
      // If error other than unverified, we proceed to try backend login
    }

    // 2. Fallback to existing backend login (maintains existing demo accounts & tests)
    const res = await authApi.login({ email: email.trim(), password });
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('parksync_token', res.token);
      localStorage.setItem('parksync_user', JSON.stringify(res.user));
    }
    return res;
  };

  /**
   * Register with Supabase and send OTP verification code to email
   */
  const registerWithSupabase = async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          role: 'DRIVER',
        },
      },
    });

    if (error) {
      throw error;
    }

    // Check if user was already created by a previous successful signup
    // In Supabase, if a user already exists with unconfirmed email, identities array is empty
    const alreadyCreated = Boolean(
      data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    );

    return { ...data, alreadyCreated };
  };

  /**
   * Verify OTP code through Supabase Auth and sync with MySQL backend
   */
  const verifyOtp = async ({ email, token: otpCode, name }) => {
    let accessToken = null;

    // Check if Supabase already has an active verified session for this user
    // (Handles retry / recovery if a previous verifyOtp succeeded with Supabase but backend sync failed)
    const { data: existingSession } = await supabase.auth.getSession();
    if (
      existingSession?.session?.access_token &&
      existingSession.session.user?.email?.toLowerCase() === email.trim().toLowerCase()
    ) {
      accessToken = existingSession.session.access_token;
    } else {
      // Exactly call supabase.auth.verifyOtp with type: "signup"
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'signup',
      });

      if (error) {
        // If token was already consumed in Supabase on a previous attempt, check for active session
        const { data: retrySession } = await supabase.auth.getSession();
        if (
          retrySession?.session?.access_token &&
          retrySession.session.user?.email?.toLowerCase() === email.trim().toLowerCase()
        ) {
          accessToken = retrySession.session.access_token;
        } else {
          throw error;
        }
      } else {
        accessToken = data?.session?.access_token;
      }
    }

    if (!accessToken) {
      throw new Error('Verification completed, but no session token was received. Please log in.');
    }

    // Sync with MySQL backend
    const syncRes = await authApi.sync({ name }, accessToken);
    if (syncRes.success && syncRes.token) {
      setToken(syncRes.token);
      setUser(syncRes.user);
      localStorage.setItem('parksync_token', syncRes.token);
      localStorage.setItem('parksync_user', JSON.stringify(syncRes.user));
      localStorage.setItem('parksync_supabase_token', accessToken);
      return syncRes;
    }

    return syncRes;
  };

  /**
   * Resend OTP verification code
   */
  const resendOtp = async (email) => {
    // Exactly call supabase.auth.resend with type: "signup"
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });

    if (error) {
      throw error;
    }

    return { success: true, message: 'A fresh verification code has been dispatched to your email.' };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('parksync_token');
    localStorage.removeItem('parksync_user');
    localStorage.removeItem('parksync_supabase_token');
  };

  const value = {
    user,
    token,
    loading,
    login,
    registerWithSupabase,
    verifyOtp,
    resendOtp,
    logout,
    isAdmin: user?.role === 'ADMIN',
    isDriver: user?.role === 'DRIVER',
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

