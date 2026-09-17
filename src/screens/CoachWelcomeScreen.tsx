import { useState, useEffect } from 'react';

interface Props {
  onDone: () => void;
}

const checklist = [
  'Personalised Plan in Under 2 Minutes',
  '7-Day Free Trial',
  'No Credit Card Required',
];

export default function CoachWelcomeScreen({ onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        .cws-root {
          position: fixed;
          inset: 0;
          background-color: #0D0D1A;
          transition: opacity 0.5s ease;
          overflow: hidden;
          height: 100vh;
          max-height: 680px;
          min-height: auto;
        }
        .cws-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0 40px 32px;
          z-index: 5;
        }
        @media (max-width: 768px) {
          .cws-bottom {
            padding: 0 24px 32px;
          }
          .cws-heading {
            font-size: 1.45rem !important;
          }
        }
      `}</style>

      <div className="cws-root" style={{ opacity: visible ? 1 : 0 }}>

        {/* Full-bleed background photo */}
        <img
          src="/coach-welcome.png"
          alt="Coach TinaBarks"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '75% 12%',
          }}
        />

        {/* Gradient overlay — face stays bright, bottom readable */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.85) 100%)',
          }}
        />

        {/* Left-side overlay — darkens logo wall behind text */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0.00) 70%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Back arrow — top left */}
        <a
          href="/"
          aria-label="Back to WeGoFit home"
          style={{
            position: 'absolute',
            top: 24,
            left: 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            zIndex: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        {/* Bottom content */}
        <div className="cws-bottom">

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                width: i === 0 ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === 0 ? '#F97316' : 'rgba(255,255,255,0.3)',
              }} />
            ))}
          </div>

          {/* Heading */}
          <h1
            className="cws-heading"
            style={{
              color: '#fff',
              fontSize: '1.8rem',
              fontWeight: 900,
              margin: '0 0 16px 0',
              letterSpacing: -0.5,
              lineHeight: 1.0,
              maxWidth: 420,
            }}
          >
            Transform Your<br />
            <span style={{ color: '#F97316' }}>Habits.</span><br />
            Transform Your<br />
            <span style={{ color: '#F97316' }}>Body.</span>
          </h1>

          {/* Subheading */}
          <p style={{
            color: '#F97316',
            fontSize: '1.1rem',
            fontWeight: 600,
            margin: '0 0 16px 0',
          }}>
            Hi, I'm Coach TinaBarks 👋
          </p>

          {/* Body */}
          <p style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            margin: '0 0 16px 0',
            maxWidth: 480,
          }}>
            Personalised nutrition, workouts, and daily accountability designed to help you achieve lasting results.
          </p>

          {/* Checklist */}
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
            {checklist.map(item => (
              <li key={item} style={{
                color: '#fff',
                fontSize: '0.9rem',
                lineHeight: 1.8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>✅</span>{item}
              </li>
            ))}
          </ul>

          {/* CTA button */}
          <button
            onClick={onDone}
            style={{
              width: 'fit-content',
              padding: '18px 48px',
              backgroundColor: '#F97316',
              borderRadius: 12,
              border: 'none',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-block',
              marginBottom: 0,
              boxShadow: '0 4px 24px rgba(249,115,22,0.45)',
            }}
          >
            Create My Plan →
          </button>
        </div>
      </div>
    </>
  );
}
