'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Mail, ArrowRight, RotateCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp, resendOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [initialName, setInitialName] = useState('');
  // Supabase project is configured with 8-digit email OTPs
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(
    'An 8-digit verification code has been sent to your email address.'
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const paramEmail = searchParams.get('email');
      const storedEmail = sessionStorage.getItem('parksync_pending_email');
      const storedName = sessionStorage.getItem('parksync_pending_name');
      const storedMsg = sessionStorage.getItem('parksync_pending_message');

      if (paramEmail || storedEmail) {
        setEmail(paramEmail || storedEmail || '');
      }
      if (storedName) {
        setInitialName(storedName);
      }
      if (storedMsg) {
        setSuccessMsg(storedMsg);
      }
    }
  }, [searchParams]);

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
      for (let i = 0; i < 8; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 7);
      if (inputRefs.current[nextFocus]) {
        inputRefs.current[nextFocus].focus();
      }
      return;
    }

    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto focus next input
    if (cleanVal && index < 7 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    if (!pasteData) return;

    const newDigits = [...otpDigits];
    const characters = pasteData.split('');
    characters.forEach((char, i) => {
      if (i < 8) newDigits[i] = char;
    });
    setOtpDigits(newDigits);

    const focusIdx = Math.min(characters.length, 7);
    if (inputRefs.current[focusIdx]) {
      inputRefs.current[focusIdx].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const fullCode = otpDigits.join('');

    if (fullCode.length !== 8) {
      setError('Please enter the complete 8-digit verification code.');
      return;
    }

    if (!email.trim()) {
      setError('Missing account email. Please return to login and try again.');
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
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('parksync_pending_email');
        sessionStorage.removeItem('parksync_pending_name');
        sessionStorage.removeItem('parksync_pending_message');
      }

      // Verification and backend sync successful!
      if (res.user?.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/driver/dashboard');
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
    if (countdown > 0 || resending) return;
    if (!email.trim()) {
      setError('Cannot resend verification code: email is missing.');
      return;
    }

    setResending(true);
    setError('');

    try {
      await resendOtp(email.trim());
      setSuccessMsg('A fresh 8-digit verification code has been dispatched to your inbox.');
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('once every')) {
        setCountdown(60);
      }
      setError(msg || 'Failed to resend verification code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-ambient-glow"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-ambient-glow" style={{ animationDelay: '-6s' }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-slate-950/95 backdrop-blur-[1px]"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 flex items-center justify-center text-white border border-teal-300/30 animate-logo-entrance animate-logo-glow">
            <ShieldCheck className="w-9 h-9 stroke-[2.2] drop-shadow-sm" />
          </div>
        </div>

        <div className="animate-title-entrance">
          <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
            Verify Your Email
          </h2>
          <p className="mt-2 text-sm text-gray-300 flex items-center justify-center gap-1.5 flex-wrap">
            <Mail className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Code sent to:</span>
            <span className="font-semibold text-teal-300">{email || 'your registered email'}</span>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-card-entrance">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/20">
          {successMsg && !error && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Verification Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider text-center mb-3">
                Enter 8-Digit Verification Code
              </label>

              {/* 8-box OTP inputs formatted in 2 clusters of 4 for clean UX */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <React.Fragment key={idx}>
                    {idx === 4 && <span className="text-gray-300 font-bold px-0.5">-</span>}
                    <input
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      autoComplete="one-time-code"
                      className="w-9 h-12 sm:w-10 sm:h-12 text-center text-lg sm:text-xl font-bold font-mono text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/20 focus:outline-none transition-all duration-150"
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 8}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/30 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:transform-none disabled:shadow-none"
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
              href="/login"
              className="font-semibold text-teal-600 hover:text-teal-700 transition-colors duration-150 hover:underline"
            >
              Return to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export const VerifyOtp = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading verification...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
};

export default VerifyOtp;
