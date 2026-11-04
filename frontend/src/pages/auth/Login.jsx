import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, AlertCircle, ArrowRight, RotateCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverifiedInfo, setUnverifiedInfo] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, resendOtp } = useAuth();
  const navigate = useNavigate();

  // Cooldown timer for resend
  React.useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedInfo(null);
    setResendFeedback('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.user?.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/driver/dashboard');
      }
    } catch (err) {
      if (err.isUnverified || err.message?.toLowerCase().includes('email not confirmed')) {
        setUnverifiedInfo(email.trim());
      } else {
        setError(err.message || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendFromLogin = async () => {
    if (!email || resending || resendCooldown > 0) return;
    setResending(true);
    setResendFeedback('');
    setError('');
    try {
      await resendOtp(email.trim());
      setResendFeedback('A fresh 6-digit OTP has been dispatched to your email.');
      setResendCooldown(60);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('once every')) {
        setResendCooldown(60);
      }
      setError(msg || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  const handleDemoFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
    setUnverifiedInfo(null);
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

        {/* Ambient Subtle Glow Orbs for modern depth */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-ambient-glow"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-ambient-glow" style={{ animationDelay: '-6s' }}></div>

        {/* Dark Navy / Charcoal Transparent Overlay for maximum contrast & readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-950/90 backdrop-blur-[1px]"></div>
      </div>

      {/* Header with ParkSync Branding & Staggered Animations */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 flex items-center justify-center text-white border border-teal-300/30 animate-logo-entrance animate-logo-glow transition-transform duration-300 hover:scale-105 cursor-pointer">
            <Car className="w-9 h-9 stroke-[2.2] drop-shadow-sm" />
          </div>
        </div>
        <div className="animate-title-entrance">
          <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
            Park<span className="text-teal-400 drop-shadow-sm">Sync</span>
          </h2>
          <p className="mt-1.5 text-xs text-slate-300 font-medium drop-shadow-sm max-w-sm mx-auto leading-relaxed">
            Intelligent Parking Reservation, Monitoring & Violation Management System
          </p>
        </div>
      </div>

      {/* Centered Login Card with Animated Slide-Up & Scale */}
      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 animate-card-entrance">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/60 transition-all duration-300 hover:shadow-teal-950/20">
          <h3 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Sign in to your account</h3>

          {/* Pending OTP Verification Alert */}
          {unverifiedInfo && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 animate-fadeIn">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Email Verification Pending</p>
                  <p className="mt-0.5 text-amber-700">
                    Your account email verification is required. Enter the 8-digit OTP sent to {unverifiedInfo}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200/60">
                <button
                  type="button"
                  onClick={() => navigate('/verify-otp', { state: { email: unverifiedInfo } })}
                  className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
                >
                  Enter OTP Code
                </button>
                <button
                  type="button"
                  onClick={handleResendFromLogin}
                  disabled={resending || resendCooldown > 0}
                  className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition inline-flex items-center gap-1"
                >
                  <RotateCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  {resending
                    ? 'Sending...'
                    : resendCooldown > 0
                    ? `Resend (${resendCooldown}s)`
                    : 'Resend OTP'}
                </button>
              </div>
              {resendFeedback && (
                <div className="mt-2 text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{resendFeedback}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all duration-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/30 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          {/* Quick Viva / Demo autofill buttons */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-3 font-medium">Quick Demo Credentials (Click to fill):</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleDemoFill('admin@parksync.com', 'admin123')}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/80 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98] text-center"
              >
                Admin Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('vikas@example.com', 'driver123')}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/80 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98] text-center"
              >
                Driver Demo (Vikas)
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors duration-150 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
