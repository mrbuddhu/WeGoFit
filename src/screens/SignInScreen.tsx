import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { storage } from '../utils/storage';
import { UserProfile, Gender, Goal, ActivityLevel } from '../types';

interface Props {
  onSignInSuccess: (profile: UserProfile) => void;
  onCreateAccount: () => void;
  isRecovery?: boolean;
  onRecoveryDone?: () => void;
}

function mapDbProfile(row: Record<string, unknown>): UserProfile {
  return {
    name:            String(row.name            ?? ''),
    age:             Number(row.age             ?? 0),
    gender:          (row.gender as Gender)     ?? 'male',
    heightCm:        Number(row.height_cm       ?? 0),
    currentWeightKg: Number(row.current_weight_kg ?? 0),
    goalWeightKg:    Number(row.goal_weight_kg  ?? 0),
    goal:            (row.goal as Goal)         ?? 'lose',
    activityLevel:   (row.activity_level as ActivityLevel) ?? 'light',
    memberSince:     String(row.member_since    ?? new Date().toISOString().split('T')[0]),
  };
}

export default function SignInScreen({ onSignInSuccess, onCreateAccount, isRecovery = false, onRecoveryDone }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [showReset,      setShowReset]      = useState(false);
  const [resetEmail,     setResetEmail]     = useState('');
  const [resetLoading,   setResetLoading]   = useState(false);
  const [resetError,     setResetError]     = useState('');
  const [resetSuccess,   setResetSuccess]   = useState(false);

  const [newPassword,    setNewPassword]    = useState('');
  const [confirmPw,      setConfirmPw]      = useState('');
  const [pwUpdateLoading, setPwUpdateLoading] = useState(false);
  const [pwUpdateError,   setPwUpdateError]   = useState('');
  const [pwUpdateSuccess, setPwUpdateSuccess] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;

      const { data: dbRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (dbRow) {
        const profile = mapDbProfile(dbRow as Record<string, unknown>);
        storage.setUserProfile(profile);
        storage.setOnboardingComplete(true);
        onSignInSuccess(profile);
      } else {
        // Authenticated but no profile yet — send through onboarding
        onCreateAccount();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Incorrect email or password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSignIn();
  };

  const handleSendReset = async () => {
    const trimmed = resetEmail.trim().toLowerCase();
    if (!trimmed) return;
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'https://wegofit.app/app',
      });
      if (resetErr) throw resetErr;
      setResetSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPw) return;
    if (newPassword !== confirmPw) {
      setPwUpdateError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPwUpdateError('Password must be at least 6 characters.');
      return;
    }
    setPwUpdateLoading(true);
    setPwUpdateError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwUpdateSuccess(true);
      // Clear the recovery hash from the URL so a refresh doesn't re-trigger recovery mode
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update password. Please try again.';
      setPwUpdateError(msg);
    } finally {
      setPwUpdateLoading(false);
    }
  };

  // ── Password recovery view ─────────────────────────────────────────────────
  if (isRecovery) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0D0D1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '40px 32px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <img src="/Enhanced_Logo.PNG" alt="WeGoFit" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          </div>

          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, textAlign: 'center', margin: '0 0 8px', letterSpacing: -0.3 }}>
            Set New Password
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', margin: '0 0 32px', lineHeight: 1.5 }}>
            Choose a strong password for your account.
          </p>

          {pwUpdateSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#4ade80', fontSize: 15, fontWeight: 600, marginBottom: 24, lineHeight: 1.5 }}>
                Password updated! Please sign in with your new password.
              </p>
              <button
                onClick={() => onRecoveryDone?.()}
                style={{
                  width: '100%', padding: '16px',
                  backgroundColor: '#F97316', borderRadius: 12, border: 'none',
                  color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(249,115,22,0.35)', transition: 'all 0.2s ease',
                }}
              >
                Go to Sign In →
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdatePassword(); }}
                  autoComplete="new-password"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdatePassword(); }}
                  autoComplete="new-password"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>

              {pwUpdateError && (
                <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16, textAlign: 'center', lineHeight: 1.4 }}>
                  {pwUpdateError}
                </p>
              )}

              <button
                onClick={handleUpdatePassword}
                disabled={pwUpdateLoading || !newPassword || !confirmPw}
                style={{
                  width: '100%', padding: '16px',
                  backgroundColor: pwUpdateLoading || !newPassword || !confirmPw
                    ? 'rgba(249,115,22,0.35)' : '#F97316',
                  borderRadius: 12, border: 'none', color: '#fff',
                  fontSize: 16, fontWeight: 700,
                  cursor: pwUpdateLoading || !newPassword || !confirmPw ? 'not-allowed' : 'pointer',
                  boxShadow: pwUpdateLoading || !newPassword || !confirmPw
                    ? 'none' : '0 4px 18px rgba(249,115,22,0.35)',
                  transition: 'all 0.2s ease', letterSpacing: 0.2,
                }}
              >
                {pwUpdateLoading ? 'Updating...' : 'Update Password →'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0D0D1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '40px 32px',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img
            src="/Enhanced_Logo.PNG"
            alt="WeGoFit"
            style={{ height: 48, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Heading */}
        <h1 style={{
          color: '#fff',
          fontSize: 24,
          fontWeight: 800,
          textAlign: 'center',
          margin: '0 0 8px',
          letterSpacing: -0.3,
        }}>
          Welcome Back!
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 14,
          textAlign: 'center',
          margin: '0 0 32px',
          lineHeight: 1.5,
        }}>
          Sign in to continue your transformation journey
        </p>

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="email"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
              style={{ ...inputStyle, paddingRight: 44 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Forgot Password link */}
        <div style={{ textAlign: 'right', marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => { setShowReset(!showReset); setResetError(''); setResetSuccess(false); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#F97316',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Forgot Password?
          </button>
        </div>

        {/* Forgot Password panel */}
        {showReset && (
          <div style={{
            backgroundColor: 'rgba(249,115,22,0.07)',
            border: '1px solid rgba(249,115,22,0.25)',
            borderRadius: 12,
            padding: '20px 16px',
            marginBottom: 20,
          }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
              Enter your email and we'll send you a reset link.
            </p>
            <input
              type="email"
              placeholder="your@email.com"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendReset(); }}
              style={{ ...inputStyle, marginBottom: 10 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            {resetError && (
              <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 10px', lineHeight: 1.4 }}>
                {resetError}
              </p>
            )}
            {resetSuccess ? (
              <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 600, margin: 0, textAlign: 'center' }}>
                Password reset link sent! Check your email.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleSendReset}
                disabled={resetLoading || !resetEmail.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: resetLoading || !resetEmail.trim()
                    ? 'rgba(249,115,22,0.35)'
                    : '#F97316',
                  borderRadius: 10,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: resetLoading || !resetEmail.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  letterSpacing: 0.2,
                }}
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{
            color: '#f87171',
            fontSize: 13,
            marginBottom: 16,
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            {error}
          </p>
        )}

        {/* Sign In button */}
        <button
          onClick={handleSignIn}
          disabled={loading || !email || !password}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: loading || !email || !password
              ? 'rgba(249,115,22,0.35)'
              : '#F97316',
            borderRadius: 12,
            border: 'none',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            boxShadow: loading || !email || !password
              ? 'none'
              : '0 4px 18px rgba(249,115,22,0.35)',
            transition: 'all 0.2s ease',
            letterSpacing: 0.2,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>or</span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Create account link */}
        <p style={{ textAlign: 'center', margin: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
            Don't have an account?{' '}
          </span>
          <button
            onClick={onCreateAccount}
            style={{
              background: 'none',
              border: 'none',
              color: '#F97316',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'none',
            }}
          >
            Start your free trial →
          </button>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  marginBottom: 6,
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 50,
  backgroundColor: '#111827',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#fff',
  fontSize: 15,
  padding: '0 16px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
};
