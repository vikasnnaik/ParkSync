'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Car, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { registerWithSupabase } = useAuth();
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { name, email, password, confirmPassword } = formData;

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setLoading(true);

    try {
      const res = await registerWithSupabase({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      const message = res?.alreadyCreated
        ? 'Account already created. Please enter the 8-digit OTP sent to your email to verify.'
        : 'Account created! Enter the 8-digit OTP sent to your email to verify.';

      // Persist email & name in session storage as safety net for page refreshes
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('parksync_pending_email', email.trim());
        sessionStorage.setItem('parksync_pending_name', name.trim());
        sessionStorage.setItem('parksync_pending_message', message);
      }

      // Redirect directly to the dedicated 8-digit OTP verification screen
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate')
      ) {
        setError(
          msg || 'An account with this email address already exists. Try signing in or verifying your OTP.'
        );
      } else {
        setError(msg || 'Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Full-screen Background Video with Fallback & Ambient Accent */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover motion-reduce:hidden"
        >
          <source src="/car-video.mp4" type="video/mp4" />
        </video>

        {/* Ambient Subtle Glow Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-ambient-glow"></div>
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-ambient-glow"
          style={{ animationDelay: '-6s' }}
        ></div>

        {/* Dark Navy / Charcoal Transparent Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-950/90 backdrop-blur-[1px]"></div>
      </div>

      {/* Header with ParkSync Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 flex items-center justify-center text-white border border-teal-300/30 animate-logo-entrance animate-logo-glow transition-transform duration-300 hover:scale-105 cursor-pointer">
            <Car className="w-9 h-9 stroke-[2.2] drop-shadow-sm" />
          </div>
        </div>
        <div className="animate-title-entrance">
          <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
            Create an <span className="text-teal-400">Account</span>
          </h2>
          <p className="mt-1.5 text-xs text-slate-300 font-medium drop-shadow-sm max-w-sm mx-auto leading-relaxed">
            Register with Supabase email OTP authentication for smart, secure parking reservations.
          </p>
        </div>
      </div>

      {/* Centered Registration Card */}
      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 animate-card-entrance">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/60 transition-all duration-300 hover:shadow-teal-950/20">
          <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Driver Registration</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-500 transition-colors duration-200">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Vikas Naik"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all duration-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-500 transition-colors duration-200">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all duration-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-500 transition-colors duration-200">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all duration-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-500 transition-colors duration-200">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all duration-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/30 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            >
              {loading ? 'Sending Verification OTP...' : 'Send Verification OTP'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-teal-600 hover:text-teal-700 transition-colors duration-150 hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
