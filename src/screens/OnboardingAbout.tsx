import { useState } from 'react';
import GoFitLogo from '../components/GoFitLogo';
import { ProgressDots } from './OnboardingGoal';
import { UserProfile, Gender, ActivityLevel, Goal } from '../types';

interface Props {
  goal: Goal;
  age: number;
  gender: Gender;
  heightCm: number;
  currentWeightKg: number;
  goalWeightKg: number;
  activityLevel: ActivityLevel;
  onNext: (profile: UserProfile, email: string, password: string) => Promise<string | null>;
  onBack: () => void;
}

const STEP = 5;
const TOTAL = 6;

const securityQuestions = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your primary school?",
  "What was your childhood nickname?",
];

export default function OnboardingAbout({
  goal, age, gender, heightCm, currentWeightKg, goalWeightKg, activityLevel,
  onNext, onBack,
}: Props) {
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showCpw,     setShowCpw]     = useState(false);
  const [secQuestion, setSecQuestion] = useState('');
  const [secAnswer,   setSecAnswer]   = useState('');
  const [agreed,      setAgreed]      = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  const isValid = !!(name && email && password.length >= 6 && password === confirmPw && secQuestion && secAnswer && agreed);

  const handleSubmit = async () => {
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (password.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    if (!agreed)               { setError('Please agree to the Terms of Service.'); return; }
    if (!name || !email || !secAnswer) return;
    setError('');
    setLoading(true);
    const err = await onNext(
      { name, age, gender, heightCm, currentWeightKg, goalWeightKg, goal, activityLevel, memberSince: new Date().toISOString().split('T')[0] },
      email,
      password,
    );
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0D0D1A',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 40px',
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {/* Back button — top left, outside content column */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.9rem',
          cursor: 'pointer',
          padding: '16px 20px',
          lineHeight: 1,
          zIndex: 10,
        }}
      >
        ← Back
      </button>

      <div style={{ maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <GoFitLogo size="md" />
        </div>

        <ProgressDots current={STEP} total={TOTAL} />

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 2vw, 28px)' as React.CSSProperties['fontSize'], fontWeight: 800, margin: '0 0 6px 0', letterSpacing: -0.4, lineHeight: 1.2 }}>
            Almost there! Create your account 🚀
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(13px, 1.2vw, 15px)' as React.CSSProperties['fontSize'], margin: 0 }}>
            Your personalised plan is ready. Let's set up your account.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Full Name">
            <input style={inputStyle} placeholder="e.g. Alex Johnson" value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Password (min 6 characters)">
            <div style={{ position: 'relative' }}>
              <input style={inputStyle} type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              <button onClick={() => setShowPw(!showPw)} style={eyeBtn} type="button">{showPw ? '🙈' : '👁'}</button>
            </div>
          </Field>
          <Field label="Confirm Password">
            <div style={{ position: 'relative' }}>
              <input style={inputStyle} type={showCpw ? 'text' : 'password'} placeholder="••••••••" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
              <button onClick={() => setShowCpw(!showCpw)} style={eyeBtn} type="button">{showCpw ? '🙈' : '👁'}</button>
            </div>
          </Field>
          <Field label="Security Question">
            <select style={{ ...inputStyle, appearance: 'none' as const }} value={secQuestion} onChange={e => setSecQuestion(e.target.value)}>
              <option value="" disabled>Select a security question...</option>
              {securityQuestions.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="Security Answer">
            <input style={inputStyle} placeholder="Your answer" value={secAnswer} onChange={e => setSecAnswer(e.target.value)} />
          </Field>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, margin: '20px 0 0', cursor: 'pointer' }}>
          <div
            onClick={() => setAgreed(!agreed)}
            style={{
              width: 22, height: 22, borderRadius: 6,
              border: `2px solid ${agreed ? '#F97316' : 'rgba(255,255,255,0.25)'}`,
              backgroundColor: agreed ? '#F97316' : 'transparent',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'all 0.18s ease',
            }}
          >
            {agreed && <svg width="11" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5 }}>
            I agree to WeGoFit's{' '}
            <a href="/terms" style={{ color: '#F97316', textDecoration: 'underline' }}>Terms of Service</a>{' '}and{' '}
            <a href="/privacy" style={{ color: '#F97316', textDecoration: 'underline' }}>Privacy Policy</a>
          </span>
        </label>

        {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          style={{
            width: '100%', height: 54,
            backgroundColor: (isValid && !loading) ? '#F97316' : 'rgba(249,115,22,0.3)',
            borderRadius: 14, border: 'none', color: '#fff', fontSize: 16, fontWeight: 800,
            cursor: (isValid && !loading) ? 'pointer' : 'not-allowed', marginTop: 24, letterSpacing: 0.2,
            boxShadow: (isValid && !loading) ? '0 4px 18px rgba(249,115,22,0.35)' : 'none', transition: 'all 0.2s ease',
          }}
        >
          {loading ? 'Creating account...' : 'Create My Account →'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 48, backgroundColor: '#111827',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
  color: '#fff', fontSize: 14, padding: '0 14px', outline: 'none', boxSizing: 'border-box',
};

const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: '1', padding: 0,
};
