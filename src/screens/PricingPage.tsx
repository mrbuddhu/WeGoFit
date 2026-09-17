import { useState } from 'react';
import GoFitLogo from '../components/GoFitLogo';
import { ProgressDots } from './OnboardingGoal';
import { SubscriptionStatus } from '../types';

interface SelectPlanMeta { currency: Currency; amount: number }

interface Props {
  isOnboarding?: boolean;
  onSelectPlan: (plan: SubscriptionStatus, meta?: SelectPlanMeta) => void;
  onMaybeLater?: () => void;
  onBack?: () => void;
  externalMessage?: string;
}

type Currency = 'UGX' | 'USD';
type PlanType = 'monthly' | 'annual';

const currencies: { id: Currency; label: string; flag: string }[] = [
  { id: 'USD', label: 'International', flag: '🌐' },
  { id: 'UGX', label: 'Uganda',        flag: '🇺🇬' },
];

const pricing: Record<Currency, { monthly: string; annual: string; annualPerMonth: string; annualSave: string }> = {
  USD: { monthly: '$20',         annual: '$192',         annualPerMonth: '$16/mo',   annualSave: 'Save $48' },
  UGX: { monthly: 'UGX 74,000', annual: 'UGX 710,000',  annualPerMonth: '≈ 59k/mo', annualSave: 'Save UGX 178k' },
};

const features = [
  'Personalized fitness coaching',
  'Smart nutrition guidance',
  'Daily accountability from Coach TinaBarks',
  'Belly fat & weight loss programs',
  'Personalized local & global meal plans',
];

const featurePills = [
  { icon: '🏃', text: 'For busy professionals' },
  { icon: '🥗', text: 'Foods you actually eat' },
  { icon: '📋', text: 'Daily accountability' },
  { icon: '🏆', text: 'Habits not just weight' },
];

const PLAN_AMOUNTS: Record<Currency, Record<PlanType, number>> = {
  USD: { monthly: 20,    annual: 192    },
  UGX: { monthly: 74000, annual: 710000 },
};

const STEP = 6;
const TOTAL = 6;

export default function PricingPage({ isOnboarding, onSelectPlan, onMaybeLater, onBack, externalMessage }: Props) {
  const [currency, setCurrency] = useState<Currency>('UGX');
  const [plan,     setPlan]     = useState<PlanType>('annual');

  const p = pricing[currency];
  const ctaLabel = plan === 'annual'
    ? `Subscribe Now — ${p.annual}`
    : `Subscribe Now — ${p.monthly}/month`;

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
      {onBack && (
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
      )}

      <div style={{ maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <GoFitLogo size="sm" />
        </div>

        {isOnboarding && <ProgressDots current={STEP} total={TOTAL} />}

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 2vw, 28px)' as React.CSSProperties['fontSize'], fontWeight: 900, margin: '0 0 8px 0', letterSpacing: -0.4, lineHeight: 1.2 }}>
            Your Transformation<br />Starts Now 👑
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(13px, 1.2vw, 15px)' as React.CSSProperties['fontSize'], margin: 0 }}>
            Join a community already seeing real results
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>
            Trusted by 50,000+ members across East Africa & beyond
          </p>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
          {features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>✅</span>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {featurePills.map(fp => (
            <div key={fp.text} style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 999, padding: '6px 14px', fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{fp.icon}</span><span>{fp.text}</span>
            </div>
          ))}
        </div>

        {/* Currency selector */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>CURRENCY</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {currencies.map(c => {
              const sel = currency === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCurrency(c.id)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 12,
                    border: `2px solid ${sel ? '#F97316' : 'rgba(255,255,255,0.1)'}`,
                    backgroundColor: sel ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer', transition: 'all 0.18s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{c.flag}</span>
                  <span style={{ color: sel ? '#F97316' : '#fff', fontSize: 13, fontWeight: 700 }}>{c.id}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Plan cards — side by side on desktop */}
        <div style={{ marginBottom: 6 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>CHOOSE PLAN</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' }}>
            {/* Annual */}
            <div
              onClick={() => setPlan('annual')}
              style={{
                position: 'relative',
                backgroundColor: plan === 'annual' ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${plan === 'annual' ? '#F97316' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16, padding: '20px 16px 16px', cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#F97316', borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                ⭐ BEST VALUE
              </div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 3 }}>Annual Plan</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 10 }}>{p.annualSave} · Coach TinaBarks' top pick 👑</div>
              <div style={{ color: '#F97316', fontWeight: 900, fontSize: 20 }}>{p.annual}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{p.annualPerMonth}</div>
            </div>

            {/* Monthly */}
            <div
              onClick={() => setPlan('monthly')}
              style={{
                backgroundColor: plan === 'monthly' ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${plan === 'monthly' ? '#F97316' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16, padding: '16px', cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 3 }}>Monthly Plan</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 10 }}>Cancel anytime · Start transforming today</div>
              <div style={{ color: plan === 'monthly' ? '#F97316' : 'rgba(255,255,255,0.7)', fontWeight: 900, fontSize: 20 }}>{p.monthly}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>/month</div>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => onSelectPlan(plan === 'annual' ? 'annual' : 'monthly', { currency, amount: PLAN_AMOUNTS[currency][plan] })}
          style={{
            width: '100%', height: 56, backgroundColor: '#F97316', borderRadius: 14,
            border: 'none', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            marginTop: 20, letterSpacing: 0.2, boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
          }}
        >
          {ctaLabel}
        </button>

        {externalMessage && (
          <div style={{
            marginTop: 12,
            padding: '12px 16px',
            backgroundColor: 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.35)',
            borderRadius: 10,
            color: '#fdba74',
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            {externalMessage}
          </div>
        )}

        {isOnboarding && onMaybeLater && (
          <button
            onClick={onMaybeLater}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 14, cursor: 'pointer', marginTop: 14, textAlign: 'center', width: '100%' }}
          >
            Not ready? → Start 7-Day Free Trial
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
          {['Contact Support', 'Delete Account', 'Privacy Policy'].map(link => (
            <a key={link} href={`/${link.toLowerCase().replace(/ /g, '-')}`} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecoration: 'none' }}>
              {link}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
