import { useState, useEffect } from 'react';
import { calcTargets } from '../utils/calculations';
import { UserProfile, SubscriptionStatus } from '../types';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

interface Props {
  profile: UserProfile;
  subscription: SubscriptionStatus;
  onUpgrade: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcBMI(weight_kg: number, height_cm: number): number {
  const h = height_cm / 100;
  return Math.round((weight_kg / (h * h)) * 10) / 10;
}

function getBMICategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight',   color: '#3B82F6', emoji: '💙', advice: "Let's build you up! Focus on nutritious meals and strength training — your transformation starts now!" };
  if (bmi < 25.0) return { label: 'Healthy Weight', color: '#10B981', emoji: '🌟', advice: "You're in the healthy zone — amazing work! Let's maintain this and build even more strength and energy!" };
  if (bmi < 30.0) return { label: 'Overweight',     color: '#F59E0B', emoji: '💪', advice: "Great news — you're closer to your goal than you think! Let's put in the work and watch those numbers drop! 🔥" };
  if (bmi < 35.0) return { label: 'High BMI',       color: '#FB923C', emoji: '🏃', advice: "Every journey starts with one step — and you've already taken it by joining WeGoFit! Let's crush this together! 💪" };
  return           { label: 'Very High BMI',         color: '#EF4444', emoji: '🔥', advice: "You are stronger than you know. WeGoFit is here every step of the way. Let's do this together! 💪" };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ORANGE = '#F97316';
const BG     = '#0D0D1A';
const CARD   = '#111827';
const CARD2  = '#1E2837';
const BORDER = 'rgba(255,255,255,0.06)';
const GREY   = 'rgba(255,255,255,0.4)';
const GREY2  = 'rgba(255,255,255,0.08)';

const PLAN_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  free:    { label: 'FREE',        bg: '#F3F4F6', text: '#888888' },
  monthly: { label: '⚡ PREMIUM',  bg: '#6366F1', text: '#FFFFFF' },
  annual:  { label: '👑 ANNUAL',   bg: '#B45309', text: '#FDE68A' },
  vip:     { label: '👑 VIP',      bg: '#B45309', text: '#FDE68A' },
};

const GOAL_LABELS: Record<string, string> = {
  lose:     '🔥 Losing Weight',
  muscle:   '💪 Building Muscle',
  maintain: '⚖️ Maintaining',
  fitness:  '🏃 Improving Fitness',
};

const ACT_LABELS: Record<string, string> = {
  sedentary:   'Sedentary',
  light:       'Light',
  active:      'Active',
  very_active: 'Very Active',
};

const OPTION_LABELS: Record<string, string> = {
  male: 'Male', female: 'Female', other: 'Other',
  sedentary: 'Sedentary', light: 'Light', active: 'Active', very_active: 'Very Active',
  lose: 'Lose Weight', muscle: 'Build Muscle', maintain: 'Maintain Weight', fitness: 'Improve Fitness',
};

const PROFILE_FIELDS = [
  { key: 'name',            icon: '🧑', label: 'Full Name',      type: 'text'   as const },
  { key: 'age',             icon: '🎂', label: 'Age',            type: 'number' as const },
  { key: 'gender',          icon: '⚥',  label: 'Gender',         options: ['male','female','other'] as string[] },
  { key: 'heightCm',        icon: '📏', label: 'Height (cm)',    type: 'number' as const },
  { key: 'currentWeightKg', icon: '⚖️', label: 'Current Weight', type: 'number' as const },
  { key: 'goalWeightKg',    icon: '🎯', label: 'Goal Weight',    type: 'number' as const },
  { key: 'activityLevel',   icon: '🏃', label: 'Activity Level', options: ['sedentary','light','active','very_active'] as string[] },
  { key: 'goal',            icon: '🥅', label: 'My Goal',        options: ['lose','muscle','maintain','fitness'] as string[] },
];

type ProfileField = (typeof PROFILE_FIELDS)[number];

const BADGES = [
  // Getting Started
  { id: 'first_step',           icon: '👶', name: 'First Step',           category: 'starter',   rarity: 'common',    points: 10,  desc: 'Log your very first meal in WeGoFit.',                                                    how: 'Log your first meal' },
  { id: 'show_up',              icon: '🚪', name: 'Show Up',               category: 'starter',   rarity: 'common',    points: 10,  desc: 'Complete WeGoFit onboarding and set your first fitness goal.',                            how: 'Complete onboarding' },
  { id: 'gravity_fighter',      icon: '⚖️', name: 'Gravity Fighter',       category: 'starter',   rarity: 'common',    points: 15,  desc: 'Log your weight for the first time.',                                                     how: 'Log your weight for the first time' },
  // Nutrition
  { id: 'clean_eater',          icon: '🥗', name: 'Clean Eater',           category: 'nutrition', rarity: 'common',    points: 25,  desc: 'Log all 4 meals in a single day — breakfast, lunch, dinner and snack.',                   how: 'Log all 4 meals in one day' },
  { id: 'calorie_sniper',       icon: '🎯', name: 'Target Tracker',        category: 'nutrition', rarity: 'uncommon',  points: 30,  desc: 'Stay within your daily calorie target.',                                                  how: 'Finish within your calorie target' },
  // Hydration
  { id: 'hydration_hero',       icon: '💧', name: 'Hydration Hero',        category: 'hydration', rarity: 'uncommon',  points: 25,  desc: 'Hit your 2L daily water goal 3 days in a row.',                                           how: 'Hit 2L water goal 3 days running' },
  // Fitness
  { id: 'off_the_couch',        icon: '🛋️', name: 'Off The Couch',         category: 'fitness',   rarity: 'common',    points: 20,  desc: 'Complete your first workout in WeGoFit.',                                                 how: 'Complete your first workout' },
  { id: 'sweat_equity',         icon: '💦', name: 'Sweat Equity',          category: 'fitness',   rarity: 'uncommon',  points: 50,  desc: 'Complete 10 workouts total.',                                                             how: 'Log 10 total workouts' },
  // Consistency
  { id: 'three_day_wonder',     icon: '✨', name: '3-Day Wonder',          category: 'streak',    rarity: 'common',    points: 20,  desc: 'Log your meals or workouts 3 days in a row.',                                             how: 'Log activity 3 days in a row' },
  { id: 'week_warrior',         icon: '🗡️', name: 'Week Warrior',          category: 'streak',    rarity: 'uncommon',  points: 40,  desc: 'Maintain a 7-day logging streak.',                                                        how: '7-day consecutive logging streak' },
  { id: 'fortnight_fighter',    icon: '⚔️', name: 'Fortnight Fighter',     category: 'streak',    rarity: 'rare',      points: 75,  desc: '14-day logging streak.',                                                                  how: '14-day consecutive streak' },
  { id: 'monthly_monster',      icon: '👹', name: 'Monthly Monster',       category: 'streak',    rarity: 'epic',      points: 150, desc: '30-day logging streak. You are a WeGoFit legend.',                                        how: '30-day consecutive streak' },
  // Weight Loss
  { id: 'one_kg_down',          icon: '🎯', name: '1KG Down',              category: 'weight',    rarity: 'rare',      points: 50,  desc: 'Lose your first kilogram since joining WeGoFit.',                                         how: 'Lose 1kg since joining WeGoFit' },
  { id: 'five_kg_titan',        icon: '🏆', name: '5KG Champion',          category: 'weight',    rarity: 'epic',      points: 150, desc: 'Lose 5kg since joining WeGoFit.',                                                         how: 'Lose 5kg since joining WeGoFit' },
  // Elite
  { id: 'transformation_titan', icon: '🦋', name: 'Transformation Titan', category: 'legend',    rarity: 'legendary', points: 300, desc: 'Complete a 30-day challenge, lose 5kg AND maintain a 30-day streak.',                     how: '30-day streak + 5kg lost + challenge complete' },
  { id: 'tinabarks_choice',     icon: '👑', name: 'TinaBarks Choice',      category: 'legend',    rarity: 'legendary', points: 200, desc: 'Personally awarded by Coach TinaBarks for outstanding dedication.',                       how: 'Awarded personally by Coach TinaBarks' },
];

const BADGE_GROUPS = [
  { key: 'starter',   label: '🚀 Getting Started' },
  { key: 'nutrition', label: '🥗 Nutrition'        },
  { key: 'hydration', label: '💧 Hydration'        },
  { key: 'fitness',   label: '🏃 Fitness'          },
  { key: 'streak',    label: '🔥 Consistency'      },
  { key: 'weight',    label: '⚖️ Weight Loss'      },
  { key: 'legend',    label: '👑 Elite'            },
] as const;

const MILESTONE_LEVELS = [
  { min: 0,    max: 99,   level: 'Beginner',  emoji: '🌱', tagline: 'Just Starting',       perk: 'Welcome badge on profile',                                                color: '#888888' },
  { min: 100,  max: 299,  level: 'Active',    emoji: '💪', tagline: 'Building Habits',     perk: 'Unlocks custom profile border',                                           color: '#4CAF50' },
  { min: 300,  max: 599,  level: 'Committed', emoji: '🔥', tagline: 'On The Journey',      perk: 'Unlocks exclusive Squad feed flair',                                      color: '#FB923C' },
  { min: 600,  max: 899,  level: 'Champion',  emoji: '🏆', tagline: 'Transformation Mode', perk: 'Featured on Squad leaderboard + special champion badge',                 color: '#4A90E2' },
  { min: 900,  max: 1170, level: 'Elite',     emoji: '👑', tagline: 'WeGoFit Legend',      perk: 'Permanent Legend crown + personal shoutout from Coach TinaBarks',        color: '#FFD700' },
];

const RARITY_CONFIG: Record<string, { label: string; color: string; cardBg: string; border: string; iconBg: string; glowRadius: number }> = {
  common:    { label: 'COMMON',    color: '#9CA3AF', cardBg: '#18212F', border: 'rgba(156,163,175,0.2)', iconBg: 'rgba(156,163,175,0.1)',  glowRadius: 6  },
  uncommon:  { label: 'UNCOMMON',  color: '#4CAF50', cardBg: '#0D3D2E', border: 'rgba(76,175,80,0.3)',   iconBg: 'rgba(76,175,80,0.12)',   glowRadius: 8  },
  rare:      { label: 'RARE',      color: '#4A90E2', cardBg: '#141C2E', border: 'rgba(74,144,226,0.3)',  iconBg: 'rgba(74,144,226,0.12)',  glowRadius: 12 },
  epic:      { label: 'EPIC',      color: '#B366FF', cardBg: '#1A1228', border: 'rgba(179,102,255,0.3)', iconBg: 'rgba(179,102,255,0.12)', glowRadius: 16 },
  legendary: { label: 'LEGENDARY', color: '#FFD700', cardBg: '#1E1A10', border: 'rgba(255,215,0,0.35)',  iconBg: 'rgba(255,215,0,0.12)',   glowRadius: 20 },
};

const SUPPORT_SUBJECTS = [
  'General Question', 'Technical Issue', 'Billing & Subscription',
  'Account Help', 'Meal Plan Question', 'Workout Advice', 'Feature Request', 'Other',
];

// ─── SettingsRow ──────────────────────────────────────────────────────────────
interface SettingsRowProps {
  icon: string;
  label: string;
  iconBg?: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  hideChevron?: boolean;
  valueStyle?: React.CSSProperties;
  right?: React.ReactNode;
}

function SettingsRow({ icon, label, iconBg, value, onPress, last, hideChevron, valueStyle, right }: SettingsRowProps) {
  return (
    <div
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', minHeight: 56,
        padding: '0 16px', cursor: onPress ? 'pointer' : 'default',
        borderBottom: last ? 'none' : `0.5px solid ${BORDER}`,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, fontSize: 16,
        backgroundColor: iconBg || CARD2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, color: '#FFF', fontSize: 15 }}>{label}</span>
      {right}
      {value !== undefined && (
        <span style={{ color: GREY, fontSize: 14, marginRight: (!hideChevron && onPress) ? 6 : 0, ...valueStyle }}>
          {value}
        </span>
      )}
      {!hideChevron && onPress && (
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, lineHeight: '22px' }}>›</span>
      )}
    </div>
  );
}

// ─── SettingsSection ──────────────────────────────────────────────────────────
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 16px 20px' }}>
      <div style={{
        color: GREY, fontSize: 11, fontWeight: 700,
        letterSpacing: '1.2px', textTransform: 'uppercase',
        marginBottom: 8, marginLeft: 4,
      }}>
        {title}
      </div>
      <div style={{ backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', border: `0.5px solid ${BORDER}` }}>
        {children}
      </div>
    </div>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (visible) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 512, zIndex: 1,
        backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '20px 20px 36px', maxHeight: '85vh', overflowY: 'auto',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', margin: '0 auto 20px' }} />
        {children}
      </div>
    </div>
  );
}

// ─── FullModal ────────────────────────────────────────────────────────────────
function FullModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (visible) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: '#1A1A2E', display: 'flex', flexDirection: 'column',
      maxWidth: 512, margin: '0 auto',
    }}>
      {children}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <div style={{
      position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
      backgroundColor: CARD2, color: '#FFF', fontWeight: 700, fontSize: 14,
      padding: '10px 20px', borderRadius: 20, border: `1px solid ${ORANGE}`,
      zIndex: 400, whiteSpace: 'nowrap', animation: 'toastFade 0.25s ease',
    }}>
      {message}
    </div>
  );
}

// ─── Change Password Sheet ────────────────────────────────────────────────────
function ChangePwModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [curPw,   setCurPw]   = useState('');
  const [newPw,   setNewPw]   = useState('');
  const [confPw,  setConfPw]  = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [error,   setError]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(false);

  function pwStrength(pw: string) {
    if (!pw) return { label: '', pct: 0, color: 'transparent' };
    if (pw.length < 6) return { label: 'Weak', pct: 25, color: '#EF4444' };
    if (pw.length < 8 || !/[0-9]/.test(pw)) return { label: 'Fair', pct: 50, color: '#F59E0B' };
    if (pw.length < 10 || !/[^a-zA-Z0-9]/.test(pw)) return { label: 'Strong', pct: 75, color: '#22C55E' };
    return { label: 'Very Strong', pct: 100, color: '#10B981' };
  }

  function reset() { setCurPw(''); setNewPw(''); setConfPw(''); setError(''); setBusy(false); setDone(false); }
  function handleClose() { onClose(); setTimeout(reset, 300); }

  async function handleUpdate() {
    setError('');
    if (!curPw) { setError('Enter your current password.'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw !== confPw) { setError('Passwords do not match.'); return; }
    setBusy(true);
    await new Promise(r => setTimeout(r, 800));
    setBusy(false);
    setDone(true);
    setTimeout(() => handleClose(), 1800);
  }

  const str      = pwStrength(newPw);
  const mismatch = confPw.length > 0 && newPw !== confPw;

  return (
    <Sheet visible={visible} onClose={handleClose}>
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
          <span style={{ fontSize: 48 }}>🎉</span>
          <div style={{ color: '#FFF', fontSize: 20, fontWeight: 800, marginTop: 16 }}>Password Updated!</div>
          <div style={{ color: GREY, fontSize: 14, marginTop: 8, textAlign: 'center' }}>Your new password is now active.</div>
        </div>
      ) : (
        <>
          <div style={{ color: '#FFF', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>🔒 Change Password</div>
          {error && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <span style={{ color: '#EF4444', fontSize: 13 }}>{error}</span>
            </div>
          )}
          {([
            { lbl: 'Current Password', val: curPw, set: setCurPw, show: showCur, tog: () => setShowCur(v => !v), err: false },
            { lbl: 'New Password',     val: newPw, set: setNewPw, show: showNew, tog: () => setShowNew(v => !v), err: false, strength: true },
            { lbl: 'Confirm Password', val: confPw, set: setConfPw, show: showCon, tog: () => setShowCon(v => !v), err: mismatch },
          ] as Array<{ lbl: string; val: string; set: (v: string) => void; show: boolean; tog: () => void; err: boolean; strength?: boolean }>).map(f => (
            <div key={f.lbl} style={{ marginBottom: 14 }}>
              <div style={{ color: GREY, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{f.lbl}</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={f.val}
                  onChange={e => { f.set(e.target.value); setError(''); }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: CARD2, border: `1px solid ${f.err ? '#EF4444' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 12, color: '#FFF', fontSize: 14,
                    padding: '12px 44px 12px 14px', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={f.tog}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: GREY, cursor: 'pointer', fontSize: 16, padding: 0 }}>
                  {f.show ? '🙈' : '👁️'}
                </button>
              </div>
              {f.strength && newPw.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 4, backgroundColor: GREY2, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${str.pct}%`, backgroundColor: str.color, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ color: str.color, fontSize: 11, fontWeight: 600, marginTop: 2, display: 'block' }}>{str.label}</span>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={handleUpdate}
            disabled={busy}
            style={{ width: '100%', backgroundColor: ORANGE, color: '#FFF', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 0', cursor: busy ? 'not-allowed' : 'pointer', marginTop: 8, opacity: busy ? 0.7 : 1, fontFamily: 'inherit' }}>
            {busy ? 'Updating…' : 'Update Password'}
          </button>
          <button onClick={handleClose} style={{ width: '100%', background: 'none', border: 'none', color: GREY, fontSize: 14, cursor: 'pointer', marginTop: 12, padding: '8px 0', fontFamily: 'inherit' }}>
            Cancel
          </button>
        </>
      )}
    </Sheet>
  );
}

// ─── Contact Support Modal ────────────────────────────────────────────────────
function ContactSupportModal({ visible, onClose, profile }: { visible: boolean; onClose: () => void; profile: UserProfile }) {
  const [subject,  setSubject]  = useState('General Question');
  const [message,  setMessage]  = useState('');
  const [sent,     setSent]     = useState(false);
  const [ticketId, setTicketId] = useState('');

  function reset() { setSubject('General Question'); setMessage(''); setSent(false); setTicketId(''); }
  function handleClose() { onClose(); setTimeout(reset, 300); }

  async function handleSend() {
    if (!message.trim()) return;
    await new Promise(r => setTimeout(r, 800));
    setTicketId(`GF${Date.now().toString().slice(-8)}`);
    setSent(true);
  }

  return (
    <FullModal visible={visible} onClose={handleClose}>
      <style>{`.sup-ta::placeholder{color:rgba(255,255,255,0.35)}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', padding: '48px 16px 16px', borderBottom: `0.5px solid ${BORDER}`, gap: 12, flexShrink: 0 }}>
        <button onClick={handleClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2, border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#FFF', fontWeight: 800, fontSize: 18 }}>Contact Support 💬</div>
          <div style={{ color: GREY, fontSize: 12, marginTop: 2 }}>We typically respond within 24 hours</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 64 }}>✅</span>
            <div style={{ color: '#FFF', fontSize: 22, fontWeight: 800, marginTop: 20 }}>Message Sent!</div>
            <div style={{ color: GREY, fontSize: 14, marginTop: 10, lineHeight: '22px' }}>
              Coach TinaBarks will reply within 24 hours<br />at support@wegofit.app
            </div>
            <div style={{ backgroundColor: CARD2, borderRadius: 12, padding: '10px 20px', marginTop: 20 }}>
              <span style={{ color: GREY, fontSize: 12 }}>Ticket: </span>
              <span style={{ color: ORANGE, fontWeight: 700, fontSize: 14 }}>#{ticketId}</span>
            </div>
            <button onClick={handleClose} style={{ marginTop: 32, backgroundColor: ORANGE, color: '#FFF', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 48px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Back to Profile
            </button>
          </div>
        ) : (
          <>
            <div style={{ backgroundColor: CARD2, borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#FFF', fontWeight: 800 }}>{profile.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div style={{ color: '#FFF', fontWeight: 700, fontSize: 14 }}>{profile.name}</div>
                <div style={{ color: GREY, fontSize: 12 }}>Member account</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: GREY, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Subject</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {SUPPORT_SUBJECTS.map(s => (
                  <button key={s} onClick={() => setSubject(s)} style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    backgroundColor: subject === s ? ORANGE : CARD2,
                    color: subject === s ? '#FFF' : GREY,
                    border: `1px solid ${subject === s ? ORANGE : 'rgba(255,255,255,0.1)'}`,
                    fontWeight: subject === s ? 700 : 400,
                  }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: GREY, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Message</div>
              <textarea
                className="sup-ta"
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 1000))}
                placeholder="Describe your issue..."
                rows={6}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'none', outline: 'none', fontFamily: 'inherit',
                  backgroundColor: CARD2, border: `1px solid ${message ? ORANGE : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 14, color: '#FFF', fontSize: 14, lineHeight: '22px',
                  padding: 14, transition: 'border-color 0.2s',
                }}
              />
              <div style={{ color: GREY, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{message.length}/1000</div>
            </div>

            <button
              onClick={handleSend}
              disabled={!message.trim()}
              style={{
                width: '100%', fontFamily: 'inherit',
                backgroundColor: message.trim() ? ORANGE : CARD2,
                color: message.trim() ? '#FFF' : GREY,
                fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14,
                padding: '14px 0', cursor: message.trim() ? 'pointer' : 'not-allowed',
              }}>
              Send Message 📨
            </button>
          </>
        )}
      </div>
    </FullModal>
  );
}

// ─── Privacy Policy Modal ─────────────────────────────────────────────────────
function PrivacyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sections = [
    { title: '1. Data Collection', body: 'We collect information you provide directly when creating an account, including your name, email, fitness goals, body metrics, and usage data. We also collect data from app usage such as food logs, workout sessions, and progress measurements.' },
    { title: '2. How We Use Your Data', body: 'Your data is used to personalise your fitness experience, calculate nutrition targets, track your progress, and enable Coach TinaBarks to provide guidance. We do not sell your personal data to third parties.' },
    { title: '3. Data Security', body: 'We implement industry-standard security measures including encryption at rest and in transit. Your data is stored with row-level security policies ensuring only you can access your personal information.' },
    { title: '4. Your Rights', body: 'You have the right to access, correct, or delete your personal data at any time. You may export your data from the Account section or contact support to request complete deletion.' },
    { title: '5. Contact Us', body: 'For privacy concerns, contact us at support@wegofit.app. We will respond within 72 hours. WeGoFit is committed to protecting your privacy.' },
  ];
  return (
    <FullModal visible={visible} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '48px 16px 16px', borderBottom: `0.5px solid ${BORDER}`, gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2, border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
        <div style={{ color: '#FFF', fontWeight: 800, fontSize: 18 }}>Privacy Policy 🔒</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: 24 }}>
            <div style={{ color: ORANGE, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: '22px' }}>{s.body}</div>
          </div>
        ))}
        <button onClick={onClose} style={{ width: '100%', backgroundColor: CARD2, color: GREY, fontWeight: 600, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 0', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>Close</button>
      </div>
    </FullModal>
  );
}

// ─── Terms of Service Modal ───────────────────────────────────────────────────
function TermsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sections = [
    { title: '1. Acceptance of Terms', body: 'By using WeGoFit, you agree to these Terms of Service. If you do not agree, please do not use the app. These terms may be updated periodically and continued use constitutes acceptance.' },
    { title: '2. Use of Service', body: 'WeGoFit is a fitness tracking and coaching app. Content provided is for informational purposes only and does not constitute medical advice. Always consult a healthcare professional before starting a fitness programme.' },
    { title: '3. Subscription & Billing', body: 'Premium subscriptions are billed monthly ($20/month) or annually ($192/year). Payments are processed via Pesapal, MTN Mobile Money, Airtel Money, Visa, or Mastercard.' },
    { title: '4. Cancellation Policy', body: 'You may cancel your subscription at any time by contacting support@wegofit.app. Cancellation takes effect at the end of your current billing period. No partial refunds are provided.' },
    { title: '5. Limitation of Liability', body: 'WeGoFit is not liable for any injury, loss, or damage arising from use of the app or reliance on its content. Results vary by individual. The app does not guarantee specific fitness outcomes.' },
  ];
  return (
    <FullModal visible={visible} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '48px 16px 16px', borderBottom: `0.5px solid ${BORDER}`, gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2, border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
        <div style={{ color: '#FFF', fontWeight: 800, fontSize: 18 }}>Terms of Service 📋</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: 24 }}>
            <div style={{ color: ORANGE, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: '22px' }}>{s.body}</div>
          </div>
        ))}
        <button onClick={onClose} style={{ width: '100%', backgroundColor: CARD2, color: GREY, fontWeight: 600, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 0', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>Close</button>
      </div>
    </FullModal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProfilePage({ profile, subscription, onUpgrade }: Props) {
  const targets    = calcTargets(profile);
  const initial    = profile.name.charAt(0).toUpperCase();
  const memberDate = profile.memberSince ? format(new Date(profile.memberSince), 'MMMM yyyy') : 'Today';
  const pb         = PLAN_BADGE[subscription] || PLAN_BADGE.free;
  const isFree     = subscription === 'free';

  const bmi        = calcBMI(profile.currentWeightKg, profile.heightCm);
  const bmiInfo    = getBMICategory(bmi);
  const waterGoal  = Math.round(profile.currentWeightKg * 0.033 * 10) / 10;
  const weeklyBurn = Math.round(targets.calories * 0.2 * 7);
  const sessions   = profile.activityLevel === 'sedentary' ? 3 : profile.activityLevel === 'light' ? 4 : 5;
  const perSession = Math.round(weeklyBurn / sessions);

  const [toast,         setToast]         = useState('');
  const [editField,     setEditField]     = useState<ProfileField | null>(null);
  const [editValue,     setEditValue]     = useState('');
  const [selBadge,      setSelBadge]      = useState<(typeof BADGES)[0] | null>(null);
  const [reminders,     setReminders]     = useState(false);
  const [units,         setUnits]         = useState<'metric' | 'imperial'>('metric');
  const [isOnline,      setIsOnline]      = useState(navigator.onLine);
  const [lastSynced,    setLastSynced]    = useState<string | null>(null);
  const [localEntries,  setLocalEntries]  = useState(0);
  const [syncing,       setSyncing]       = useState(false);
  const [showLogout,    setShowLogout]    = useState(false);
  const [showDelete,    setShowDelete]    = useState(false);
  const [showChangePw,  setShowChangePw]  = useState(false);
  const [showSupport,   setShowSupport]   = useState(false);
  const [showPrivacy,   setShowPrivacy]   = useState(false);
  const [showTerms,     setShowTerms]     = useState(false);
  const [localProfile,  setLocalProfile]  = useState<UserProfile>(profile);
  const [subRecord,     setSubRecord]     = useState<{ paid_at?: string; next_billing_date?: string; currency?: string } | null>(null);
  const [authEmail,     setAuthEmail]     = useState<string>('');

  // Simple unlock heuristics based on available profile data
  const unlockedBadges: string[] = [];
  if (localProfile.name) { unlockedBadges.push('show_up', 'first_step'); }
  if (localProfile.currentWeightKg) unlockedBadges.push('gravity_fighter');
  if (subscription !== 'free') unlockedBadges.push('off_the_couch');
  const userPoints = unlockedBadges.reduce((acc, id) => acc + (BADGES.find(b => b.id === id)?.points ?? 0), 0);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    try {
      setReminders(localStorage.getItem('remindersEnabled') === 'true');
      const raw = localStorage.getItem('gofit_last_synced');
      if (raw) setLastSynced(raw);
      setLocalEntries(localStorage.length);
    } catch { /* ignore */ }
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (isFree) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data } = await supabase
          .from('subscriptions')
          .select('paid_at, next_billing_date, currency')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setSubRecord(data ?? null);
      } catch { /* ignore */ }
    })();
  }, [isFree]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) setAuthEmail(session.user.email);
      } catch { /* ignore */ }
    })();
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  function openEdit(field: ProfileField) {
    setEditField(field);
    setEditValue(String((localProfile as unknown as Record<string, unknown>)[field.key] ?? ''));
  }

  function saveEdit() {
    if (!editField) return;
    let val: string | number = editValue.trim();
    if (!val) { setEditField(null); return; }
    if (editField.type === 'number') {
      const n = parseFloat(String(val));
      if (isNaN(n) || n <= 0) { showToast('Invalid value'); return; }
      val = n;
    }
    const updated = { ...localProfile, [editField.key]: val } as UserProfile;
    setLocalProfile(updated);
    try { localStorage.setItem('gofit_user_profile', JSON.stringify(updated)); } catch { /* ignore */ }
    setEditField(null);
    showToast('Profile updated! ✅');
  }

  function fieldDisplayValue(field: ProfileField): string {
    const v = (localProfile as unknown as Record<string, unknown>)[field.key];
    if (v === undefined || v === null || v === '') return '—';
    const s = String(v);
    if (field.key === 'gender')          return s.charAt(0).toUpperCase() + s.slice(1);
    if (field.key === 'activityLevel')   return ACT_LABELS[s] || s;
    if (field.key === 'goal')            return OPTION_LABELS[s] || s;
    if (field.key === 'currentWeightKg' || field.key === 'goalWeightKg') return `${v} ${units === 'metric' ? 'kg' : 'lbs'}`;
    if (field.key === 'heightCm')        return `${v} ${units === 'metric' ? 'cm' : 'ft'}`;
    if (field.key === 'age')             return `${v} yrs`;
    return s;
  }

  async function handleForceSync() {
    if (!isOnline) { showToast('Cannot sync while offline'); return; }
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1800));
    const now = new Date().toISOString();
    try { localStorage.setItem('gofit_last_synced', now); } catch { /* ignore */ }
    setLastSynced(now);
    setSyncing(false);
    showToast('Data synced! ✅');
  }

  function handleExport() {
    const data: Record<string, unknown> = { profile: localProfile, subscription, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'wegofit-data.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported! ✅');
  }

  function handleLogout() {
    setShowLogout(false);
    try { localStorage.clear(); } catch { /* ignore */ }
    window.location.reload();
  }

  async function handleDeleteAccount() {
    setShowDelete(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from('profiles').delete().eq('id', session.user.id);
        await supabase.auth.signOut();
      }
    } catch { /* ignore — clear locally regardless */ }
    try { localStorage.clear(); } catch { /* ignore */ }
    window.location.href = 'https://wegofit.app';
  }

  // BMI scale
  const MAX_BMI = 40;
  const bmiZones = [
    { end: 18.5, color: '#3B82F6', label: 'Under' },
    { end: 25,   color: '#10B981', label: 'Healthy' },
    { end: 30,   color: '#F59E0B', label: 'Over' },
    { end: MAX_BMI, color: '#FB923C', label: 'High' },
  ];
  const bmiDotPct = Math.min(bmi / MAX_BMI, 1) * 100;

return (
    <div style={{ backgroundColor: BG, minHeight: '100svh', paddingBottom: 100 }}>
      <style>{`
        @keyframes toastFade { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        input,textarea,button { font-family: inherit; }
        input::placeholder { color: rgba(255,255,255,0.35); }
        .profile-pills::-webkit-scrollbar { display: none; }
      `}</style>

      {toast && <Toast message={toast} />}

      {/* ── 1. HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: CARD, paddingTop: 40, paddingBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: `0.5px solid ${BORDER}`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, left: 16 }}>
          <img src="/Enhanced_Logo.PNG" alt="WeGoFit" style={{ height: 40, objectFit: 'contain' }} />
        </div>
        <div style={{
          position: 'absolute', top: 16, right: 16,
          backgroundColor: pb.bg === '#F3F4F6' ? CARD2 : pb.bg,
          borderRadius: 20, padding: '4px 10px',
        }}>
          <span style={{ color: pb.bg === '#F3F4F6' ? 'rgba(255,255,255,0.55)' : pb.text, fontSize: 11, fontWeight: 800 }}>{pb.label}</span>
        </div>

        <div style={{ marginBottom: 14, marginTop: 28 }}>
          <div style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: CARD2, border: `3px solid ${ORANGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: ORANGE, fontSize: 32, fontWeight: 800 }}>{initial}</span>
          </div>
        </div>

        <div style={{ color: '#FFF', fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>{localProfile.name}</div>
        <div style={{ backgroundColor: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '5px 14px', marginTop: 10 }}>
          <span style={{ color: ORANGE, fontSize: 13, fontWeight: 700 }}>{GOAL_LABELS[localProfile.goal] || '🏃 Getting Fit'}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8 }}>WeGoFit Member since {memberDate}</div>
      </div>

      {/* ── 2. STATS ROW ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', margin: '16px 16px 4px', backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', border: `0.5px solid ${BORDER}` }}>
        {[
          { v: targets.calories.toLocaleString(), l: 'Cal/day' },
          { v: `${localProfile.currentWeightKg}kg`, l: 'Current' },
          { v: '0d', l: 'Streak' },
        ].map((s, i) => (
          <div key={s.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', borderRight: i < 2 ? `0.5px solid ${BORDER}` : 'none' }}>
            <span style={{ color: ORANGE, fontSize: 22, fontWeight: 800 }}>{s.v}</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{s.l}</span>
          </div>
        ))}
      </div>

      {/* ── 3. HEALTH METRICS ─────────────────────────────────────────────── */}
      <div style={{ margin: '16px 16px 0', backgroundColor: CARD, borderRadius: 16, padding: 16, border: `0.5px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ color: '#FFF', fontWeight: 700, fontSize: 15 }}>Your Health Metrics</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, backgroundColor: bmiInfo.color + '20', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', border: `1px solid ${bmiInfo.color}40` }}>
            <span style={{ color: bmiInfo.color, fontSize: 26, fontWeight: 800 }}>{bmi}</span>
            <span style={{ color: bmiInfo.color, fontSize: 12, fontWeight: 700, marginTop: 2 }}>{bmiInfo.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 }}>BMI Score</span>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(249,115,22,0.25)' }}>
            <span style={{ color: ORANGE, fontSize: 26, fontWeight: 800 }}>{targets.calories.toLocaleString()}</span>
            <span style={{ color: ORANGE, fontSize: 12, fontWeight: 700, marginTop: 2 }}>kcal / day</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 }}>Daily Target</span>
          </div>
        </div>

        {/* BMI scale bar */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>BMI Scale</span>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 6, marginBottom: 6 }}>
            {bmiZones.map((z, i) => {
              const start = i === 0 ? 0 : bmiZones[i - 1].end;
              return <div key={z.label} style={{ flex: z.end - start, backgroundColor: z.color }} />;
            })}
          </div>
          <div style={{ position: 'relative', height: 16 }}>
            <div style={{ position: 'absolute', left: `${bmiDotPct}%`, transform: 'translateX(-50%)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: bmiInfo.color, border: '2px solid #FFF' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            {['18.5','25.0','30.0','35+'].map(l => <span key={l} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{l}</span>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 2 }}>
            {bmiZones.map(z => <span key={z.label} style={{ color: z.color, fontSize: 9, fontWeight: 600 }}>{z.label}</span>)}
          </div>
        </div>

        <div style={{ backgroundColor: bmiInfo.color + '12', borderRadius: 10, padding: 10, borderLeft: `3px solid ${bmiInfo.color}` }}>
          <span style={{ color: bmiInfo.color, fontSize: 13, fontWeight: 600 }}>{bmiInfo.emoji} {bmiInfo.advice}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 8, textAlign: 'center' }}>Calculated using Mifflin-St Jeor formula</div>
      </div>

      <div style={{ height: 20 }} />

      {/* ── 4. NUTRITION TARGETS ──────────────────────────────────────────── */}
      <SettingsSection title="Nutrition Targets 🥗">
        {[
          { icon: '🔥', label: 'Daily Calories',   value: `${targets.calories.toLocaleString()} kcal` },
          { icon: '🥩', label: 'Protein Target',   value: `${targets.proteinG}g` },
          { icon: '🍞', label: 'Carbs Target',     value: `${targets.carbsG}g` },
          { icon: '🥑', label: 'Fat Target',       value: `${targets.fatG}g` },
          { icon: '💧', label: 'Water Goal',       value: `${waterGoal}L/day` },
          { icon: '🔥', label: 'Weekly Burn Goal', value: `${weeklyBurn.toLocaleString()} kcal`, vs: { color: ORANGE } as React.CSSProperties },
          { icon: '🏋️', label: 'Sessions / Week',  value: `${sessions}x · ~${perSession.toLocaleString()} kcal each`, vs: { color: ORANGE } as React.CSSProperties },
        ].map((row, i, arr) => (
          <SettingsRow key={row.label} icon={row.icon} label={row.label} value={row.value} last={i === arr.length - 1} hideChevron valueStyle={row.vs} />
        ))}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 10 }}>Calculated using Mifflin-St Jeor formula</div>
          <button onClick={() => showToast('Targets recalculated! ✅')} style={{ width: '100%', border: `1px solid ${ORANGE}`, backgroundColor: 'transparent', borderRadius: 10, padding: '10px 0', color: ORANGE, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            ↻ Recalculate Targets
          </button>
        </div>
      </SettingsSection>

      {/* ── 5. MY MEAL PLAN ───────────────────────────────────────────────── */}
      <SettingsSection title="My Meal Plan 🗓️">
        <SettingsRow icon="🗓️" label="Weekly Meal Plan" value="View Plan" onPress={() => showToast('Navigate to Nutrition tab to view your meal plan')} last />
      </SettingsSection>

      <div style={{ height: 4 }} />

      {/* ── 6. MY PLAN ────────────────────────────────────────────────────── */}
      <SettingsSection title="My Plan 💎">
        <div style={{ padding: 16 }}>
          {isFree ? (
            <div style={{ backgroundColor: CARD2, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: '#FFF', fontWeight: 700, fontSize: 15 }}>My Subscription</span>
                <span style={{ backgroundColor: 'rgba(249,115,22,0.2)', color: ORANGE, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>FREE TRIAL</span>
              </div>
              <div style={{ height: 6, backgroundColor: GREY2, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: '14%', backgroundColor: ORANGE, borderRadius: 3 }} />
              </div>
              <div style={{ color: ORANGE, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>7 days remaining of your free trial</div>
              <button onClick={onUpgrade} style={{ width: '100%', backgroundColor: ORANGE, color: '#FFF', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 0', cursor: 'pointer', marginBottom: 12 }}>
                Upgrade to Premium 👑
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { plan: 'Annual',  price: '$16/mo', sub: 'Save 20% · Best Value', highlight: true },
                  { plan: 'Monthly', price: '$20/mo', sub: 'Cancel anytime',         highlight: false },
                ].map(p => (
                  <div key={p.plan} onClick={onUpgrade} style={{ flex: 1, backgroundColor: p.highlight ? 'rgba(249,115,22,0.12)' : CARD, border: `1px solid ${p.highlight ? ORANGE : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ color: '#FFF', fontWeight: 700, fontSize: 14 }}>{p.plan}</div>
                    <div style={{ color: ORANGE, fontWeight: 800, fontSize: 18, marginTop: 4 }}>{p.price}</div>
                    <div style={{ color: GREY, fontSize: 11, marginTop: 2 }}>{p.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: CARD2, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: '#FFF', fontWeight: 700, fontSize: 15 }}>My Subscription</span>
                <span style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                  {subscription === 'annual' ? 'ANNUAL' : 'MONTHLY'}
                </span>
              </div>
              <div style={{ backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ color: ORANGE, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                  {subscription === 'annual' ? '👑 WeGoFit Annual' : '⚡ WeGoFit Monthly'}
                </div>
                <div style={{ color: GREY, fontSize: 13 }}>
                  {subscription === 'annual' ? '$16/month · Billed $192/year' : '$20/month · Billed monthly'}
                </div>
                {subRecord?.paid_at && (
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6 }}>
                    Last payment: {new Date(subRecord.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                {subRecord?.next_billing_date && (
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                    Next billing: {new Date(subRecord.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
              <button onClick={() => showToast('Contact support@wegofit.app to manage your subscription')} style={{ width: '100%', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', borderRadius: 12, padding: '12px 0', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Manage Subscription
              </button>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* ── 7. BADGES & REWARDS ───────────────────────────────────────────── */}
      <div style={{ margin: '4px 0 20px' }}>

        {/* Milestone header */}
        {(() => {
          const pts = userPoints;
          const milestone = MILESTONE_LEVELS.slice().reverse().find(m => pts >= m.min) || MILESTONE_LEVELS[0];
          const nextMilestone = MILESTONE_LEVELS.find(m => m.min > pts);
          const progressPct = nextMilestone
            ? Math.min(((pts - milestone.min) / (nextMilestone.min - milestone.min)) * 100, 100)
            : 100;
          return (
            <div style={{ margin: '0 16px 12px', backgroundColor: CARD, borderRadius: 16, padding: 16, border: `0.5px solid ${BORDER}` }}>
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#FFF', fontSize: 17, fontWeight: 800 }}>Badges & Rewards 🏅</span>
                <span style={{ backgroundColor: ORANGE + '25', border: `1px solid ${ORANGE}60`, color: ORANGE, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                  {unlockedBadges.length}/{BADGES.length}
                </span>
              </div>

              {/* Milestone pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, backgroundColor: milestone.color + '18', borderRadius: 12, padding: 10, border: `1px solid ${milestone.color}40` }}>
                <span style={{ fontSize: 24 }}>{milestone.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ color: milestone.color, fontSize: 13, fontWeight: 800 }}>{milestone.level}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{milestone.tagline}</span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{milestone.perk}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: milestone.color, fontSize: 20, fontWeight: 800 }}>{pts}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>pts</div>
                </div>
              </div>

              {/* Progress toward next milestone */}
              {nextMilestone ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
                      {'Next: '}
                      <span style={{ color: nextMilestone.color, fontWeight: 700 }}>{nextMilestone.emoji} {nextMilestone.level}</span>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
                      <span style={{ color: '#CCC', fontWeight: 700 }}>{nextMilestone.min - pts}</span>{' pts to go'}
                    </span>
                  </div>
                  <div style={{ height: 6, backgroundColor: GREY2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: milestone.color, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: '#FFD700', fontSize: 10, fontWeight: 700 }}>Max level reached! 🎉</span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>{pts}/1170 pts</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: GREY2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '100%', backgroundColor: '#FFD700', borderRadius: 3 }} />
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Grouped badge grid */}
        <div style={{ margin: '0 16px', backgroundColor: CARD, borderRadius: 20, padding: '4px 12px 12px', border: `0.5px solid ${BORDER}` }}>
          {BADGE_GROUPS.map((group, gi) => {
            const groupBadges = BADGES.filter(b => b.category === group.key);
            const rows: (typeof BADGES)[] = [];
            for (let i = 0; i < groupBadges.length; i += 3) rows.push(groupBadges.slice(i, i + 3));
            return (
              <div key={group.key} style={{ marginTop: gi === 0 ? 8 : 0, marginBottom: gi < BADGE_GROUPS.length - 1 ? 20 : 8 }}>
                {/* Category header */}
                <div style={{ color: '#FFF', fontSize: 13, fontWeight: 800, letterSpacing: '0.5px', paddingBottom: 8, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {group.label}
                </div>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 10, marginBottom: ri < rows.length - 1 ? 10 : 0 }}>
                    {row.map(b => {
                      const unlocked = unlockedBadges.includes(b.id);
                      const rarity   = RARITY_CONFIG[b.rarity] || RARITY_CONFIG.common;
                      return (
                        <div key={b.id} onClick={() => setSelBadge(b)}
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 130,
                            backgroundColor: unlocked ? rarity.cardBg : '#1A1A2E',
                            borderRadius: 16, padding: 12,
                            border: `1px solid ${unlocked ? rarity.border : 'rgba(255,255,255,0.05)'}`,
                            cursor: 'pointer', opacity: unlocked ? 1 : 0.6, position: 'relative',
                            boxShadow: unlocked ? `0 0 ${rarity.glowRadius}px ${rarity.color}30` : 'none',
                            transition: 'opacity 0.2s',
                          }}>
                          <div style={{ width: 54, height: 54, borderRadius: 14,
                            backgroundColor: unlocked ? rarity.iconBg : '#222233',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 8, position: 'relative',
                            border: unlocked ? `1px solid ${rarity.border}` : 'none' }}>
                            <span style={{ fontSize: 26, opacity: unlocked ? 1 : 0.15 }}>{b.icon}</span>
                            {!unlocked && <span style={{ position: 'absolute', fontSize: 18, color: '#444' }}>🔒</span>}
                          </div>
                          {!unlocked && <span style={{ color: '#555', fontSize: 8, fontWeight: 800, letterSpacing: '1.2px', marginBottom: 4 }}>LOCKED</span>}
                          <span style={{ color: unlocked ? '#FFF' : '#666', fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: '13px', marginBottom: 4 }}>{b.name}</span>
                          <span style={{ color: unlocked ? rarity.color : '#444', fontSize: 8, fontWeight: 800, letterSpacing: '0.8px' }}>{rarity.label}</span>
                          {unlocked && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: rarity.color, boxShadow: `0 0 6px ${rarity.color}` }} />}
                        </div>
                      );
                    })}
                    {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => <div key={i} style={{ flex: 1 }} />)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 8. MY PROFILE ─────────────────────────────────────────────────── */}
      <SettingsSection title="My Profile 👤">
        <SettingsRow icon="📧" label="Login Email" value={authEmail || (localProfile as unknown as Record<string,string>)['email'] || 'Not set'} hideChevron />
        {PROFILE_FIELDS.map((field, i) => (
          <SettingsRow key={field.key} icon={field.icon} label={field.label} value={fieldDisplayValue(field)} onPress={() => openEdit(field)} last={i === PROFILE_FIELDS.length - 1} />
        ))}
      </SettingsSection>

      {/* ── 9. COACH & SUPPORT ────────────────────────────────────────────── */}
      <SettingsSection title="Coach & Support 💬">
        {([
          { icon: '💬', label: 'Message Coach TinaBarks', onPress: () => showToast('Tap the Coach tab to chat!') },
          { icon: '⭐', label: 'Rate WeGoFit',            onPress: () => showToast('Opening App Store…') },
          { icon: '📧', label: 'Contact Support',         onPress: () => setShowSupport(true) },
          { icon: '🔒', label: 'Privacy Policy',          onPress: () => setShowPrivacy(true) },
          { icon: '📋', label: 'Terms of Service',        onPress: () => setShowTerms(true), last: true },
        ] as Array<{ icon: string; label: string; onPress: () => void; last?: boolean }>).map(row => (
          <SettingsRow key={row.label} icon={row.icon} label={row.label} onPress={row.onPress} last={row.last} />
        ))}
      </SettingsSection>

      {/* ── 10. APP PREFERENCES ───────────────────────────────────────────── */}
      <SettingsSection title="App Preferences ⚙️">
        <SettingsRow
          icon="🔔" label="Reminders" hideChevron
          right={
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 26, marginRight: 8, flexShrink: 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={reminders} onChange={e => { setReminders(e.target.checked); try { localStorage.setItem('remindersEnabled', String(e.target.checked)); } catch { /* ignore */ } }} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', inset: 0, backgroundColor: reminders ? ORANGE : CARD2, borderRadius: 13, transition: '0.3s', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span style={{ position: 'absolute', height: 18, width: 18, left: reminders ? 22 : 3, bottom: 3, backgroundColor: '#FFF', borderRadius: 9, transition: '0.3s' }} />
              </span>
            </label>
          }
        />
        <SettingsRow
          icon="📏" label="Units" hideChevron
          right={
            <div style={{ display: 'flex', gap: 6, marginRight: 0 }}>
              {(['metric','imperial'] as const).map(u => (
                <button key={u} onClick={() => setUnits(u)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: units === u ? ORANGE : CARD2, color: units === u ? '#FFF' : GREY, fontSize: 12, fontWeight: 700 }}>
                  {u === 'metric' ? 'kg/cm' : 'lbs/ft'}
                </button>
              ))}
            </div>
          }
        />
        <SettingsRow icon="🌍" label="Language" value="English" last hideChevron />
      </SettingsSection>

      {/* ── 11. DATA SYNC ─────────────────────────────────────────────────── */}
      <SettingsSection title="Data Sync">
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnline ? '#10B981' : '#F59E0B', flexShrink: 0 }} />
            <span style={{ color: '#FFF', fontSize: 14, fontWeight: 600 }}>{isOnline ? 'Connected' : 'Offline'}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, backgroundColor: CARD2, borderRadius: 12, padding: 12 }}>
              <div style={{ color: ORANGE, fontWeight: 800, fontSize: 18 }}>{localEntries}</div>
              <div style={{ color: GREY, fontSize: 11, marginTop: 2 }}>Local records</div>
            </div>
            <div style={{ flex: 1, backgroundColor: CARD2, borderRadius: 12, padding: 12 }}>
              <div style={{ color: '#FFF', fontWeight: 700, fontSize: 12 }}>
                {lastSynced ? new Date(lastSynced).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never synced'}
              </div>
              <div style={{ color: GREY, fontSize: 11, marginTop: 2 }}>Last synced</div>
            </div>
          </div>
          {!isOnline && (
            <div style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <span style={{ color: '#F59E0B', fontSize: 12 }}>You are offline. Data is saved locally and will sync when you reconnect.</span>
            </div>
          )}
          <button onClick={handleForceSync} disabled={syncing || !isOnline} style={{ width: '100%', border: `1px solid ${isOnline ? ORANGE : 'rgba(255,255,255,0.2)'}`, backgroundColor: 'transparent', borderRadius: 10, padding: '10px 0', color: isOnline ? ORANGE : GREY, fontWeight: 700, fontSize: 14, cursor: isOnline && !syncing ? 'pointer' : 'not-allowed', opacity: (!isOnline || syncing) ? 0.5 : 1 }}>
            {syncing ? 'Syncing…' : 'Force Sync Now'}
          </button>
        </div>
      </SettingsSection>

      {/* ── 12. ACCOUNT ───────────────────────────────────────────────────── */}
      <SettingsSection title="Account">
        <SettingsRow icon="🔑" label="Change Password" onPress={() => setShowChangePw(true)} />
        <SettingsRow icon="📤" label="Export My Data"  onPress={handleExport} last />
      </SettingsSection>

      {/* ── 13. LOG OUT / DELETE ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <button onClick={() => setShowLogout(true)} style={{ padding: '12px 48px', borderRadius: 14, backgroundColor: CARD2, border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Log Out
        </button>
        <button onClick={() => setShowDelete(true)} style={{ padding: '10px 32px', marginTop: 12, background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Delete Account
        </button>
      </div>

      {/* ── 14. FOOTER ────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', paddingBottom: 24 }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>WeGoFit v1.0.0 · © 2026 WeGoFit</div>
      </div>

      {/* ─── SHEETS & MODALS ────────────────────────────────────────────── */}

      {/* Edit field */}
      <Sheet visible={!!editField} onClose={() => setEditField(null)}>
        {editField && (
          <>
            <div style={{ color: '#FFF', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Edit {editField.label}</div>
            {editField.options ? (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {editField.options.map(opt => (
                  <div key={opt} onClick={() => setEditValue(opt)} style={{ display: 'flex', alignItems: 'center', padding: '14px 4px', borderBottom: `0.5px solid ${BORDER}`, cursor: 'pointer' }}>
                    <span style={{ flex: 1, color: '#FFF', fontSize: 15 }}>{OPTION_LABELS[opt] || opt}</span>
                    {editValue === opt && <span style={{ color: ORANGE, fontSize: 18 }}>✓</span>}
                  </div>
                ))}
              </div>
            ) : (
              <input
                type={editField.type === 'number' ? 'number' : 'text'}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: CARD2, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#FFF', fontSize: 14, padding: '12px 14px', outline: 'none', marginBottom: 4 }}
              />
            )}
            <div style={{ height: 16 }} />
            <button onClick={saveEdit} style={{ width: '100%', backgroundColor: ORANGE, color: '#FFF', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 0', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditField(null)} style={{ width: '100%', background: 'none', border: 'none', color: GREY, fontSize: 14, cursor: 'pointer', marginTop: 12, padding: '8px 0' }}>Cancel</button>
          </>
        )}
      </Sheet>

      {/* Badge detail */}
      <Sheet visible={!!selBadge} onClose={() => setSelBadge(null)}>
        {selBadge && (() => {
          const unlocked = unlockedBadges.includes(selBadge.id);
          const rarity   = RARITY_CONFIG[selBadge.rarity] || RARITY_CONFIG.common;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
              <span style={{ fontSize: 56, opacity: unlocked ? 1 : 0.3, marginBottom: 12 }}>{selBadge.icon}</span>
              <div style={{ color: '#FFF', fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{selBadge.name}</div>
              <div style={{ backgroundColor: rarity.color + '30', border: `1px solid ${rarity.color}60`, borderRadius: 20, padding: '5px 14px', marginBottom: 14 }}>
                <span style={{ color: rarity.color, fontSize: 11, fontWeight: 800, letterSpacing: '1px' }}>{rarity.label} · {selBadge.points} pts</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: '20px', marginBottom: 10 }}>{selBadge.desc}</div>
              {!unlocked && (
                <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: 10, marginBottom: 10, width: '100%' }}>
                  <span style={{ color: GREY, fontSize: 11 }}>How to earn: {selBadge.how}</span>
                </div>
              )}
              {unlocked && <div style={{ color: '#10B981', fontSize: 14, fontWeight: 800, marginBottom: 4 }}>✓ Earned!</div>}
              <button onClick={() => setSelBadge(null)} style={{ marginTop: 16, backgroundColor: ORANGE, color: '#FFF', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 14, padding: '12px 36px', cursor: 'pointer' }}>Close</button>
            </div>
          );
        })()}
      </Sheet>

      {/* Logout confirm */}
      <Sheet visible={showLogout} onClose={() => setShowLogout(false)}>
        <div style={{ color: '#FFF', fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>Log out of WeGoFit?</div>
        <div style={{ color: GREY, textAlign: 'center', fontSize: 14, marginBottom: 24, lineHeight: '20px' }}>Your data will be saved and ready when you return.</div>
        <button onClick={handleLogout} style={{ width: '100%', backgroundColor: CARD2, color: '#FFF', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, padding: '14px 0', cursor: 'pointer' }}>Log Out</button>
        <button onClick={() => setShowLogout(false)} style={{ width: '100%', background: 'none', border: 'none', color: GREY, fontSize: 15, cursor: 'pointer', marginTop: 12, padding: '8px 0' }}>Cancel</button>
      </Sheet>

      {/* Delete confirm */}
      {showDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
        }}>
          <div style={{
            width: '100%', maxWidth: 340,
            backgroundColor: '#1a1a2e',
            borderRadius: 20,
            padding: '28px 24px',
          }}>
            <div style={{ color: '#FFF', fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 16 }}>
              Delete Account
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6, marginBottom: 8, textAlign: 'center' }}>
              This will permanently delete your WeGoFit account and all data:
            </div>
            <ul style={{ color: '#FFF', fontSize: 14, lineHeight: 1.6, marginBottom: 20, paddingLeft: 20 }}>
              <li>Profile</li>
              <li>Food logs</li>
              <li>Workout history</li>
              <li>Progress data</li>
            </ul>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDelete(false)}
                style={{
                  flex: 1, padding: '16px 0', borderRadius: 50,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: 'none', color: '#FFF',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                style={{
                  flex: 1, padding: '16px 0', borderRadius: 50,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: 'none', color: '#EF4444',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangePwModal visible={showChangePw} onClose={() => setShowChangePw(false)} />
      <ContactSupportModal visible={showSupport} onClose={() => setShowSupport(false)} profile={localProfile} />
      <PrivacyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}
