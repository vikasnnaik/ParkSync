import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Mail, ArrowRight, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const VerifyOtp = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyOtp, resendOtp } = useAuth();

  const initialEmail =
    location.state?.email ||
    searchParams.get('email') ||
    sessionStorage.getItem('parksync_pending_email') ||
    '';
  const initialName =
    location.state?.name ||
    sessionStorage.getItem('parksync_pending_name') ||
    '';

  const [email, setEmail] = useState(initialEmail);
  // Supabase project is configured with 8-digit email OTPs
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(
    location.state?.message || 'An 8-digit verification code has been sent to your email address.'
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Focus the first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleDigitChange = (index, value) => {
    // Only accept numeric input
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal && value !== '') return;

    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Handle paste of full 8-digit code
      const pasted = cleanVal.slice(0, 8).split('');
      pasted.forEach((char, i) => {
        if (i < 8) newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 7);
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex].focus();
      }
      return;
    }

    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (cleanVal && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 8);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    pastedData.split('').forEach((char, i) => {
      if (i < 8) newDigits[i] = char;
    });
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pastedData.length, 7);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    const fullCode = otpDigits.join('');
    if (fullCode.length !== 8) {
      setError(`Please enter the complete 8-digit verification code. (Currently entered: ${fullCode.length}/8 digits)`);
      return;
    }

    setLoading(true);

    try {
      // Send exact email, exact entered token, type: 'signup'
      const res = await verifyOtp({
        email: email.trim(),
        token: fullCode.trim(),
        name: initialName,
      });

      // Clear pending email from session storage on success
      sessionStorage.removeItem('parksync_pending_email');
      sessionStorage.removeItem('parksync_pending_name');

      // Verification and backend sync successful!
      if (res.user?.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/driver/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = err.message || '';
      const lower = msg.toLowerCase();

      if (lower.includes('expired')) {
        setError('This verification code has expired. Please click "Resend Code" to receive a fresh OTP.');
      } else if (lower.includes('invalid') || lower.includes('token')) {
        setError('Invalid verification code. Please check your inbox and enter the exact 8-digit OTP.');
      } else if (lower.includes('network error') || lower.includes('failed to fetch') || lower.includes('econnrefused')) {
        setError('Unable to connect to the ParkSync server (Network Error). Please verify that the backend server is running on http://localhost:5000 and try again.');
      } else if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('seconds')) {
        setError('Verification rate limit exceeded. Please wait a moment before trying again.');
      } else {
        setError(msg || 'Verification failed. Please check the code and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    // Prevent repeated clicks while pending or cooling down
    if (countdown > 0 || resending) return;

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address to resend the code.');
      return;
    }

    setError('');
    setResending(true);

    try {
      await resendOtp(email.trim());
      setSuccessMsg(`A fresh 8-digit verification code has been dispatched to ${email.trim()}.`);
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('once every') ||
        msg.toLowerCase().includes('seconds')
      ) {
        setCountdown(60);
      }
      setError(msg || 'Failed to resend verification OTP. Please wait before retrying.');
    } finally {
      setResending(false);
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 flex items-center justify-center text-white border border-teal-300/30 animate-logo-entrance animate-logo-glow shadow-xl">
            <ShieldCheck className="w-9 h-9 stroke-[2.2] drop-shadow-sm" />
          </div>
        </div>
        <div className="animate-title-entrance">
          <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
            Verify Your <span className="text-teal-400">Email</span>
          </h2>
          <p className="mt-1.5 text-xs text-slate-300 font-medium drop-shadow-sm max-w-sm mx-auto leading-relaxed">
            Enter the 8-digit verification code sent to your inbox to activate your ParkSync account.
          </p>
        </div>
      </div>

      {/* Centered OTP Verification Card */}
      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 animate-card-entrance">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-8 border border-white/60 transition-all duration-300">
          {successMsg && !error && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Verification Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3 py-2 bg-gray-50/60 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  8-Digit Security Code
                </label>
                <span className="text-[11px] font-medium text-slate-500">
                  {otpDigits.filter(Boolean).length}/8 entered
                </span>
              </div>

              {/* 8 Digits in 2 groups of 4 with clean responsive spacing */}
              <div
                className="flex items-center justify-between gap-1 sm:gap-1.5"
                onPaste={handlePaste}
              >
                {/* First 4 Digits */}
                <div className="flex gap-1 sm:gap-1.5">
                  {otpDigits.slice(0, 4).map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-8 sm:w-10 h-11 sm:h-13 text-center text-lg sm:text-xl font-bold bg-gray-50/80 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-gray-900 transition-all duration-200 shadow-sm"
                    />
                  ))}
                </div>

                {/* Hyphen Separator */}
                <span className="text-gray-400 font-bold px-0.5 select-none text-sm sm:text-base">-</span>

                {/* Second 4 Digits */}
                <div className="flex gap-1 sm:gap-1.5">
                  {otpDigits.slice(4, 8).map((digit, idx) => {
                    const actualIdx = idx + 4;
                    return (
                      <input
                        key={actualIdx}
                        ref={(el) => (inputRefs.current[actualIdx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(actualIdx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(actualIdx, e)}
                        className="w-8 sm:w-10 h-11 sm:h-13 text-center text-lg sm:text-xl font-bold bg-gray-50/80 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-gray-900 transition-all duration-200 shadow-sm"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 8}
              className="w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/30 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            >
              {loading ? 'Verifying Code...' : 'Verify & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Resend OTP Action */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-500 text-center">Didn't receive the email code?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || resending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:text-gray-400 transition"
            >
              <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              {resending
                ? 'Sending fresh code...'
                : countdown > 0
                ? `Resend Code in ${countdown}s`
                : 'Resend Verification Code'}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-600">
            Want to use a different account?{' '}
            <Link
              to="/login"
              className="font-semibold text-teal-600 hover:text-teal-700 transition-colors duration-150 hover:underline"
            >
              Return to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
