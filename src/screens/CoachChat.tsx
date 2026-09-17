import { useState, useEffect, useRef, useCallback } from 'react';
import { SubscriptionStatus } from '../types';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://yswkyjfsxsbmshliphet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2t5amZzeHNibXNobGlwaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTQxMTksImV4cCI6MjA5NDE5MDExOX0.fo_Eq_6c3jk8Ws02TJLxNWX3qHSD2otu3ZvdQBVeD1Y';

interface Props {
  subscription: SubscriptionStatus;
  onUpgrade: () => void;
}

interface Msg {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: string;
  isWelcome?: boolean;
  name?: string;
  greeting?: string;
  goalText?: string;
  quickStart?: string[];
}

interface Profile {
  id?: string;
  email?: string;
  name?: string;
  goal?: string;
  weight_kg?: number;
  dailyCalorieTarget?: number;
  activity_level?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ORANGE = '#F97316';
const BG = '#0D0D1A';
const HEADER_BG = '#070B14';
const CARD = 'rgba(255,255,255,0.08)';
const GREY = 'rgba(255,255,255,0.4)';

const HASHTAG_QUESTIONS: Record<string, string> = {
  '#WeightLoss': "What's the best strategy for losing weight consistently?",
  '#MuscleGain': 'How can I build muscle effectively at home?',
  '#Nutrition':  'What should I eat to hit my calorie and protein goals?',
  '#Mindset':    'How do I stay motivated when I feel like giving up?',
};

// ─── Helper functions ─────────────────────────────────────────────────────────
function detectMessageCategory(message: string): string {
  const msg = message.toLowerCase();
  if (msg.match(/food|eat|meal|calori|protein|carb|fat|diet|nutrition|breakfast|lunch|dinner|snack|ugali|matoke|chapati|sukuma|kachumbari/)) return 'nutrition';
  if (msg.match(/workout|exercise|run|cycl|walk|hiit|train|gym|session|cardio|strength/)) return 'workout';
  if (msg.match(/sleep|rest|tired|recovery|insomnia|wake/)) return 'sleep';
  if (msg.match(/weight|fat|slim|lose|gain|bmi|belly|scale/)) return 'weight';
  if (msg.match(/water|hydrat|drink/)) return 'hydration';
  if (msg.match(/motivat|give up|hard|struggle|quit|discourag/)) return 'motivation';
  if (msg.match(/supplement|protein powder|creatine|vitamin/)) return 'supplement';
  if (msg.match(/pain|hurt|injur|sore|ache/)) return 'recovery';
  return 'general';
}

function getFallbackReply(category: string, profile?: Profile): string {
  const name = profile?.name || 'there';
  const replies: Record<string, string[]> = {
    nutrition: [
      `Great question ${name}! Focus on hitting your protein target first. Include sukuma wiki or spinach daily for iron and vitamins. Coach TinaBarks will personally follow up soon! 🌸`,
      `For your goal, fill half your plate with vegetables like kachumbari at lunch. Keep dinner light — protein + greens only. Coach TinaBarks will follow up soon! 🌸`,
    ],
    workout: [
      `Consistency beats perfection every time ${name}! Even a 20-min walk counts. Log it in WeGoFit and watch your streak build! Coach TinaBarks will personally follow up soon! 🌸`,
      `Mix cardio with strength training across the week. Your WeGoFit Train tab has everything you need! Coach TinaBarks will follow up soon! 🌸`,
    ],
    sleep: [
      `Sleep is your secret weapon ${name}! 7-9 hours = better recovery, less cravings and more fat burn. Try sleeping before 10PM tonight. Coach TinaBarks will follow up soon! 🌸`,
    ],
    weight: [
      `You are closer than you think ${name}! Trust the process — your body is changing even when the scale doesn't move. Focus on how you FEEL. Coach TinaBarks will personally follow up soon! 🌸`,
      `Small consistent steps beat drastic measures every time. Stick to your calorie target and keep logging! Coach TinaBarks will check your progress soon! 🌸`,
    ],
    hydration: [
      `Water is your best fat-loss tool ${name}! Aim for 2L daily. Try warm lemon water first thing in the morning — it boosts metabolism! Coach TinaBarks will follow up soon! 🌸`,
    ],
    motivation: [
      `You showed up today ${name} and that is everything! Progress is not always visible but it IS happening. Trust the journey. Coach TinaBarks believes in you completely! 🌸`,
      `Every champion was once a beginner who refused to give up. You have already taken the hardest step — starting. Keep going ${name}! Coach TinaBarks is in your corner always! 🌸`,
    ],
    supplement: [
      `Focus on whole foods first ${name}. Whey protein post-workout is a great addition if needed. Creatine is safe and effective for strength. Coach TinaBarks will give a specific recommendation soon! 🌸`,
    ],
    recovery: [
      `Please listen to your body ${name}. Rest days are as important as workout days. If pain persists please see a doctor. Light stretching and hydration help recovery. Coach TinaBarks will follow up soon! 🌸`,
    ],
    general: [
      `Thank you for reaching out ${name}! Your dedication is inspiring. Keep logging, keep moving and keep believing. Coach TinaBarks will personally reply very soon! 🌸`,
      `Hey ${name}! Great to hear from you. Your WeGoFit journey is looking amazing — keep up the consistency! Coach TinaBarks will personally follow up soon! 🌸`,
    ],
  };
  const options = replies[category] || replies.general;
  return options[Math.floor(Math.random() * options.length)];
}

async function getAICoachReply(userMessage: string, profile?: Profile): Promise<string> {
  const category = detectMessageCategory(userMessage);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const anonKey = SUPABASE_ANON_KEY;
    const accessToken = session?.access_token ?? anonKey;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Apikey': anonKey,
      },
      body: JSON.stringify({
        mode: 'coach',
        messages: [{ role: 'user', content: userMessage }],
        userContext: {
          name: profile?.name,
          goal: profile?.goal,
          weight_kg: profile?.weight_kg,
          dailyCalorieTarget: profile?.dailyCalorieTarget,
          activity_level: profile?.activity_level,
        },
      }),
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.reply;
  } catch {
    return getFallbackReply(category, profile);
  }
}

function generateWelcomeMessage(profile?: Profile): Msg {
  const name = profile?.name || 'Champion';
  const goal = profile?.goal;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const goalText = ({
    lose:     'lose weight and feel amazing',
    gain:     'build muscle and get stronger',
    maintain: 'maintain your healthy lifestyle',
    fitness:  'improve your fitness and energy',
  } as Record<string, string>)[goal || ''] || 'reach your fitness goals';
  const quickStart = ({
    lose:     ['Log all 4 meals today', 'Hit your 2L water goal', 'Take a 20-minute walk', 'Check your personalised meal plan'],
    gain:     ['Log your protein intake today', 'Complete your first workout', 'Hit your calorie target', 'Check your meal plan for muscle gain'],
    maintain: ['Log today\'s meals', 'Stay hydrated — 2L today', 'Move for at least 30 minutes', 'Check in on your progress'],
    fitness:  ['Start with a 20-minute workout', 'Log all your meals today', 'Hit your water goal', 'Explore the workout videos'],
  } as Record<string, string[]>)[goal || ''] || ['Log today\'s meals', 'Drink 2L of water', 'Complete a workout', 'Check your meal plan'];

  return {
    id: 'welcome_' + Date.now(),
    role: 'coach',
    isWelcome: true,
    timestamp: new Date().toISOString(),
    text: `${greeting} ${name}! Welcome to WeGoFit! 🎉`,
    name, greeting, goalText, quickStart,
  };
}

function getProfile(): Profile {
  try { return JSON.parse(localStorage.getItem('gofit_user_profile') ?? '{}'); } catch { return {}; }
}

function getChatKey(profile: Profile): string {
  const userId = profile?.id || profile?.email || 'guest';
  return `gofit_chat_${userId}`;
}

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── WelcomeMessageBubble ─────────────────────────────────────────────────────
function WelcomeMessageBubble({ message }: { message: Msg }) {
  return (
    <div style={{ backgroundColor: '#1A1A2E', borderRadius: 20, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 26, backgroundColor: ORANGE,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0,
        }}>
          <span style={{ color: '#FFF', fontSize: 18, fontWeight: 800 }}>TB</span>
        </div>
        <div>
          <div style={{ color: '#FFF', fontSize: 16, fontWeight: 800 }}>Coach TinaBarks 🌸</div>
          <div style={{ color: GREY, fontSize: 12, marginTop: 2 }}>WeGoFit Head Coach · Just now</div>
        </div>
      </div>

      <div style={{ color: '#FFF', fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
        {message.greeting} {message.name}! 🎉
      </div>

      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: '1.6', marginBottom: 16 }}>
        Welcome to the WeGoFit family — I am so excited you are here!
        <br /><br />
        You have just taken the BIGGEST step — deciding to start. That takes real courage and I see you! 💪
        <br /><br />
        Your goal to {message.goalText} is 100% achievable. I have designed WeGoFit to help clients just like you get real results.
      </div>

      <div style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ color: ORANGE, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎯 Your Quick Start Today:</div>
        {(message.quickStart || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 10, backgroundColor: ORANGE,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: '#FFF', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ color: ORANGE, fontSize: 14, fontWeight: 700, textAlign: 'right' }}>— Coach TinaBarks 🌸</div>
    </div>
  );
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, animation: 'msgFade 0.2s ease-out' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, border: '2px solid rgba(249,115,22,0.4)',
      }}>
        <span style={{ color: '#FFF', fontWeight: 800, fontSize: 11 }}>TB</span>
      </div>
      <div>
        <div style={{
          backgroundColor: CARD, borderRadius: 18, borderBottomLeftRadius: 4,
          padding: '12px 16px', display: 'inline-flex', gap: 5, alignItems: 'center',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%', backgroundColor: ORANGE,
              animation: `typingDot 1.2s ease-in-out ${i * 180}ms infinite`,
            }} />
          ))}
        </div>
        <p style={{ color: GREY, fontSize: 11, fontStyle: 'italic', margin: '4px 0 0' }}>TinaBarks is typing...</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CoachChat({ subscription, onUpgrade }: Props) {
  void onUpgrade;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  // Keep isPremium for any parent logic that passes it, but it has no UI effect here
  const _isPremium = subscription === 'monthly' || subscription === 'annual';
  void _isPremium;

  // ── Online listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Load / seed messages ──────────────────────────────────────────────────
  useEffect(() => {
    const profile  = getProfile();
    const chatKey  = getChatKey(profile);
    const userId   = profile?.id || profile?.email || 'guest';
    const flagKey  = `gofit_welcome_sent_${userId}`;

    let saved: Msg[] = [];
    try { saved = JSON.parse(localStorage.getItem(chatKey) ?? '[]'); } catch { saved = []; }

    const welcomeSent = localStorage.getItem(flagKey);

    if (!welcomeSent && profile?.name) {
      const welcome = generateWelcomeMessage(profile);
      const hasWelcome = saved.some(m => m.isWelcome);
      const initial = hasWelcome ? saved : [welcome, ...saved];
      setMessages(initial);
      localStorage.setItem(chatKey, JSON.stringify(initial));
      localStorage.setItem(flagKey, '1');
    } else if (saved.length > 0) {
      setMessages(saved);
    } else {
      const welcome = generateWelcomeMessage(profile);
      setMessages([welcome]);
      localStorage.setItem(chatKey, JSON.stringify([welcome]));
    }
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Persist ───────────────────────────────────────────────────────────────
  const persist = useCallback((msgs: Msg[]) => {
    const profile = getProfile();
    localStorage.setItem(getChatKey(profile), JSON.stringify(msgs));
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────
  async function sendMessage(overrideText?: string) {
    const msgText = (overrideText ?? input).trim();
    if (!msgText || isTyping) return;

    const profile = getProfile();
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: msgText,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    persist(updated);
    setInput('');
    setIsTyping(true);

    const delay = 1500 + Math.random() * 1000;
    await new Promise(r => setTimeout(r, delay));

    const replyText = await getAICoachReply(msgText, profile);

    const coachMsg: Msg = {
      id: `c-${Date.now()}`,
      role: 'coach',
      text: replyText,
      timestamp: new Date().toISOString(),
    };
    const final = [...updated, coachMsg];
    setMessages(final);
    persist(final);
    setIsTyping(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 64px)', overflow: 'hidden', backgroundColor: BG }}>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30%            { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes msgFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes onlinePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.4); }
        }
        .coach-scroll::-webkit-scrollbar { display: none; }
        .coach-scroll { scrollbar-width: none; }
        .chat-textarea { resize: none; outline: none; font-family: inherit; }
        .chat-textarea::placeholder { color: rgba(255,255,255,0.35); }
        .hashtag-pill::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, backgroundColor: HEADER_BG,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '48px 16px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar with online dot */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 19, backgroundColor: ORANGE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(249,115,22,0.5)',
            }}>
              <span style={{ color: '#FFF', fontWeight: 800, fontSize: 14 }}>CT</span>
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: isOnline ? '#22c55e' : '#6b7280',
              border: '2px solid ' + HEADER_BG,
              animation: isOnline ? 'onlinePulse 2s ease-in-out infinite' : 'none',
            }} />
          </div>
          {/* Name */}
          <div style={{ flex: 1 }}>
            <div style={{ color: '#FFF', fontWeight: 800, fontSize: 16 }}>Coach TinaBarks</div>
            <div style={{ color: ORANGE, fontSize: 12, fontWeight: 600, marginTop: 2 }}>WeGoFit Head Coach 👑</div>
          </div>
        </div>

        {/* Hashtag pills */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12,
          paddingBottom: 2, scrollbarWidth: 'none',
        }}>
          {Object.keys(HASHTAG_QUESTIONS).map(tag => (
            <button
              key={tag}
              onClick={() => { if (!isTyping) { setInput(HASHTAG_QUESTIONS[tag]); inputRef.current?.focus(); } }}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
                backgroundColor: 'rgba(249,115,22,0.12)',
                border: '1px solid rgba(249,115,22,0.3)',
                color: ORANGE,
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── OFFLINE BANNER ──────────────────────────────────────────────── */}
      {!isOnline && (
        <div style={{
          flexShrink: 0, backgroundColor: '#FEF3C7',
          padding: '8px 16px', textAlign: 'center',
        }}>
          <span style={{ color: '#92400E', fontSize: 12, fontWeight: 600 }}>
            You are offline. Messages will be sent when you reconnect.
          </span>
        </div>
      )}

      {/* ── MESSAGES ────────────────────────────────────────────────────── */}
      <div
        className="coach-scroll"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 14px 16px',
          display: 'flex', flexDirection: 'column', gap: 12,
          backgroundColor: BG,
        }}
      >
        {messages.map(msg => {
          if (msg.isWelcome) {
            return <WelcomeMessageBubble key={msg.id} message={msg} />;
          }

          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', animation: 'msgFade 0.2s ease-out' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                {!isUser && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, border: '2px solid rgba(249,115,22,0.4)',
                  }}>
                    <span style={{ color: '#FFF', fontWeight: 800, fontSize: 10 }}>TB</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '72%',
                  padding: '10px 14px',
                  borderRadius: 18,
                  borderBottomRightRadius: isUser ? 4 : 18,
                  borderBottomLeftRadius:  isUser ? 18 : 4,
                  backgroundColor: isUser ? ORANGE : CARD,
                  color: '#FFF', fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-line',
                }}>
                  {msg.text}
                </div>
              </div>
              <div style={{ marginTop: 4, paddingLeft: isUser ? 0 : 36, paddingRight: isUser ? 0 : 0 }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{fmtTime(msg.timestamp)}</span>
                {!isUser && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontStyle: 'italic', margin: '2px 0 0' }}>
                    🤖 AI Assistant · TinaBarks will follow up personally
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT BAR ───────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        backgroundColor: BG,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '12px',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          rows={1}
          className="chat-textarea"
          placeholder="Ask Coach TinaBarks anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          style={{
            flex: 1, minHeight: 44, maxHeight: 120,
            padding: '10px 14px',
            backgroundColor: CARD,
            border: 'none', borderRadius: 12,
            color: '#FFF', fontSize: 14, lineHeight: '22px',
            cursor: 'text', resize: 'none', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isTyping}
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            backgroundColor: input.trim() && !isTyping ? ORANGE : 'rgba(255,255,255,0.1)',
            border: 'none',
            cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: input.trim() && !isTyping ? '#FFF' : GREY,
            fontSize: 18, fontWeight: 700,
            transition: 'background-color 0.15s',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
