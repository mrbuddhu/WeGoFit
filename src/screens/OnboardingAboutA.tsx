import { useState, useRef, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import GoFitLogo from '../components/GoFitLogo';
import { Gender } from '../types';

interface Props {
  onNext: (age: number, gender: Gender) => void;
  onBack: () => void;
}

const AGES = Array.from({ length: 65 }, (_, i) => i + 16); // 16–80
const ITEM_W = 60;
const DEFAULT_AGE = 25;
const DEFAULT_AGE_INDEX = DEFAULT_AGE - 16;

const genderOptions: { id: Gender; label: string; emoji: string }[] = [
  { id: 'male', label: 'Male', emoji: '👨' },
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'other', label: 'Other', emoji: '🌟' },
];

export default function OnboardingAboutA({ onNext, onBack }: Props) {
  const [age, setAge] = useState(DEFAULT_AGE);
  const [gender, setGender] = useState<Gender>('male');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  // Center the default age on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    const offset = DEFAULT_AGE_INDEX * ITEM_W - (containerWidth / 2 - ITEM_W / 2);
    el.scrollLeft = offset;
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    const centerX = el.scrollLeft + containerWidth / 2;
    const index = Math.round((centerX - ITEM_W / 2) / ITEM_W);
    const clamped = Math.max(0, Math.min(AGES.length - 1, index));
    setAge(AGES[clamped]);
  }

  function snapToAge(targetIndex: number) {
    const el = scrollRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    const offset = targetIndex * ITEM_W - (containerWidth / 2 - ITEM_W / 2);
    el.scrollTo({ left: offset, behavior: 'smooth' });
    setAge(AGES[targetIndex]);
  }

  function handleScrollEnd() {
    const el = scrollRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    const centerX = el.scrollLeft + containerWidth / 2;
    const index = Math.round((centerX - ITEM_W / 2) / ITEM_W);
    const clamped = Math.max(0, Math.min(AGES.length - 1, index));
    snapToAge(clamped);
  }

  // Mouse drag support for desktop
  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX;
    scrollStart.current = scrollRef.current?.scrollLeft ?? 0;
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = scrollStart.current - (e.pageX - startX.current);
  }
  function onMouseUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    handleScrollEnd();
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col px-5 py-8 overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-white/60 hover:text-white transition-colors p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <GoFitLogo size="sm" />
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex gap-1 mb-6">
          <div className="h-1 flex-1 rounded-full bg-green-500" />
          <div className="h-1 flex-1 rounded-full bg-green-500" />
          <div className="h-1 flex-1 rounded-full bg-white/20" />
          <div className="h-1 flex-1 rounded-full bg-white/20" />
          <div className="h-1 flex-1 rounded-full bg-white/20" />
          <div className="h-1 flex-1 rounded-full bg-white/20" />
        </div>
        <p className="text-green-500 text-sm font-medium mb-2">Step 2 of 6</p>
        <h1 className="font-heading text-3xl font-bold text-white leading-tight">
          First, let's get<br />to know you
        </h1>
        <p className="text-white/50 mt-2">This helps us personalize everything</p>
      </div>

      <div className="flex-1 flex flex-col gap-8">
        {/* AGE WHEEL */}
        <div>
          <label className="text-white/70 text-sm font-medium mb-4 block">Your Age</label>

          {/* Selected value display */}
          <div className="flex items-end justify-center gap-2 mb-4">
            <span
              style={{ color: '#FF6B35', fontSize: 56, fontWeight: 800, lineHeight: 1 }}
            >
              {age}
            </span>
            <span className="text-white/40 text-lg mb-2">yrs</span>
          </div>

          {/* Scroll wheel */}
          <div className="relative">
            {/* Center indicator */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-10"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                width: ITEM_W,
              }}
            >
              {/* Underline bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 8,
                  right: 8,
                  height: 3,
                  borderRadius: 2,
                  background: '#FF6B35',
                  opacity: 0.8,
                }}
              />
            </div>

            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to right, #0D1B2A, transparent)' }} />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
              style={{ background: 'linear-gradient(to left, #0D1B2A, transparent)' }} />

            <div
              ref={scrollRef}
              className="flex overflow-x-scroll select-none"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                cursor: 'grab',
                height: 64,
              }}
              onScroll={handleScroll}
              onScrollCapture={undefined}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {/* Left padding spacer */}
              <div style={{ minWidth: 'calc(50% - 30px)', flexShrink: 0 }} />

              {AGES.map((a) => {
                const dist = Math.abs(a - age);
                const isCenter = dist === 0;
                const opacity = isCenter ? 1 : dist === 1 ? 0.45 : dist === 2 ? 0.25 : 0.12;
                const fontSize = isCenter ? 36 : dist === 1 ? 22 : 16;
                return (
                  <div
                    key={a}
                    onClick={() => snapToAge(a - 16)}
                    style={{
                      minWidth: ITEM_W,
                      height: 52,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize,
                      fontWeight: isCenter ? 800 : 500,
                      color: isCenter ? '#FF6B35' : '#FFFFFF',
                      opacity,
                      transition: 'font-size 0.15s ease, opacity 0.15s ease',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {a}
                  </div>
                );
              })}

              {/* Right padding spacer */}
              <div style={{ minWidth: 'calc(50% - 30px)', flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* GENDER CARDS */}
        <div>
          <label className="text-white/70 text-sm font-medium mb-3 block">Gender</label>
          <div className="flex gap-3">
            {genderOptions.map((g) => {
              const isSelected = gender === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  style={{
                    flex: 1,
                    height: 88,
                    backgroundColor: '#111827',
                    borderRadius: 16,
                    borderWidth: isSelected ? 2 : 1,
                    borderStyle: 'solid',
                    borderColor: isSelected ? '#FF6B35' : 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    boxShadow: isSelected
                      ? '0 0 14px rgba(255,107,53,0.5)'
                      : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{g.emoji}</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected ? '#FF6B35' : 'rgba(255,255,255,0.75)',
                  }}>
                    {g.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={() => onNext(age, gender)}
        style={{
          width: '100%',
          height: 54,
          backgroundColor: '#FF6B35',
          borderRadius: 14,
          border: 'none',
          color: '#FFF',
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          marginTop: 32,
          letterSpacing: 0.3,
        }}
      >
        Continue →
      </button>
    </div>
  );
}
