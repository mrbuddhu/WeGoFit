import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import SplashScreen from './screens/SplashScreen';
import SignInScreen from './screens/SignInScreen';
import CoachWelcomeScreen from './screens/CoachWelcomeScreen';
import OnboardingGoal from './screens/OnboardingGoal';
import OnboardingChallenge from './screens/OnboardingChallenge';
import OnboardingAboutB from './screens/OnboardingAboutB';
import PlanPreview from './screens/PlanPreview';
import OnboardingAbout from './screens/OnboardingAbout';
import PricingPage from './screens/PricingPage';
import Dashboard from './screens/Dashboard';
import FoodDiary from './screens/FoodDiary';
import WorkoutScreen from './screens/WorkoutScreen';
import CoachChat from './screens/CoachChat';
import ProfilePage from './screens/ProfilePage';
import BottomNav from './components/BottomNav';
import { storage } from './utils/storage';
import { AppScreen, NavTab, Goal, Gender, ActivityLevel, UserProfile, SubscriptionStatus } from './types';

// Mifflin-St Jeor BMR → TDEE → calorie target
function calcDailyCalories(
  age: number, gender: Gender, heightCm: number,
  weightKg: number, goalWeightKg: number, activity: ActivityLevel,
): number {
  const bmr = gender === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const multiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, active: 1.55, very_active: 1.725,
  };
  const tdee = bmr * multiplier[activity];
  return weightKg > goalWeightKg ? Math.round(tdee - 500) : Math.round(tdee + 300);
}

// Maps snake_case Supabase profile row → camelCase UserProfile
function mapDbProfile(row: Record<string, unknown>): UserProfile {
  return {
    name:            String(row.name         ?? ''),
    age:             Number(row.age          ?? 0),
    gender:          (row.gender as Gender)  ?? 'male',
    heightCm:        Number(row.height_cm    ?? 0),
    currentWeightKg: Number(row.weight_kg    ?? 0),
    goalWeightKg:    Number(row.goal_weight  ?? 0),
    goal:            (row.goal as Goal)      ?? 'lose',
    activityLevel:   (row.activity as ActivityLevel) ?? 'light',
    memberSince:     String(row.member_since ?? new Date().toISOString().split('T')[0]),
  };
}

async function fetchSupabaseProfile(): Promise<UserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  return data ? mapDbProfile(data as Record<string, unknown>) : null;
}

const ONBOARDING_SCREENS: AppScreen[] = [
  'splash', 'sign-in', 'coach-welcome', 'onboarding-goal', 'onboarding-challenge',
  'onboarding-measurements', 'onboarding-plan-preview',
  'onboarding-create-account', 'onboarding-pricing',
];

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  // Set to true when bootstrap routes to 'home' so splash/coach-welcome don't overwrite it
  const bootstrapNavigated = useRef(false);

  // Onboarding state
  const [onboardingGoal,         setOnboardingGoal]         = useState<Goal>('lose');
  const [onboardingChallenge,    setOnboardingChallenge]    = useState('');
  const [onboardingAge,          setOnboardingAge]          = useState(25);
  const [onboardingGender,       setOnboardingGender]       = useState<Gender>('male');
  const [onboardingHeightCm,     setOnboardingHeightCm]     = useState(165);
  const [onboardingWeightKg,     setOnboardingWeightKg]     = useState(70);
  const [onboardingGoalWeightKg, setOnboardingGoalWeightKg] = useState(65);
  const [onboardingActivity,     setOnboardingActivity]     = useState<ActivityLevel>('light');

  const [profile,           setProfile]           = useState<UserProfile | null>(null);
  const [subscription,      setSubscription]      = useState<SubscriptionStatus>('free');
  const [paymentMessage,    setPaymentMessage]    = useState('');
  const [currentUserId,     setCurrentUserId]     = useState<string>('');
  const [currentUserEmail,  setCurrentUserEmail]  = useState<string>('');
  const [isRecovery,        setIsRecovery]        = useState(false);

  useEffect(() => {
    async function bootstrap() {
      // Password recovery: Supabase appends #access_token=...&type=recovery
      if (window.location.hash.includes('type=recovery')) {
        bootstrapNavigated.current = true;
        setIsRecovery(true);
        setScreen('sign-in');
        return;
      }

      const isSignInRoute = window.location.pathname === '/signin';

      const sub = storage.getSubscription();
      setSubscription(sub);

      // Fast path: localStorage already populated
      const savedProfile = storage.getUserProfile();
      const onboarded    = storage.isOnboardingComplete();
      if (savedProfile && onboarded) {
        bootstrapNavigated.current = true;
        setProfile(savedProfile);
        setScreen('home');
        return;
      }

      // Slow path: check Supabase for a returning user whose localStorage is empty
      const dbProfile = await fetchSupabaseProfile();
      if (dbProfile) {
        storage.setUserProfile(dbProfile);
        storage.setOnboardingComplete(true);
        bootstrapNavigated.current = true;
        setProfile(dbProfile);
        setScreen('home');
        return;
      }

      // No session/profile — if on /signin show the sign-in form
      if (isSignInRoute) {
        bootstrapNavigated.current = true;
        setScreen('sign-in');
        return;
      }

      // New user on /app — normal splash → onboarding flow
    }
    bootstrap();
  }, []);

  // Guard: non-onboarding screen with no profile → back to coach-welcome
  useEffect(() => {
    if (!profile && !ONBOARDING_SCREENS.includes(screen)) {
      setScreen('coach-welcome');
    }
  }, [profile, screen]);

  const handleSplashDone = useCallback(() => {
    if (bootstrapNavigated.current) return;
    setScreen('coach-welcome');
  }, []);

  const handleCoachWelcomeDone = useCallback(async () => {
    const savedProfile = storage.getUserProfile();
    const onboarded    = storage.isOnboardingComplete();
    if (onboarded && savedProfile) {
      setProfile(savedProfile);
      setScreen('home');
      return;
    }
    // localStorage missing — check Supabase before sending to onboarding
    const dbProfile = await fetchSupabaseProfile();
    if (dbProfile) {
      storage.setUserProfile(dbProfile);
      storage.setOnboardingComplete(true);
      setProfile(dbProfile);
      setScreen('home');
      return;
    }
    setScreen('onboarding-goal');
  }, []);

  const handleGoalSelected = (goal: Goal) => {
    setOnboardingGoal(goal);
    setScreen('onboarding-challenge');
  };

  const handleChallengeSelected = (challenge: string) => {
    setOnboardingChallenge(challenge);
    setScreen('onboarding-measurements');
  };

  const handleMeasurementsDone = (
    heightCm: number, weightKg: number, goalWeightKg: number,
    activity: ActivityLevel, gender: Gender, age: number,
  ) => {
    setOnboardingHeightCm(heightCm);
    setOnboardingWeightKg(weightKg);
    setOnboardingGoalWeightKg(goalWeightKg);
    setOnboardingActivity(activity);
    setOnboardingGender(gender);
    setOnboardingAge(age);
    setScreen('onboarding-plan-preview');
  };

  const handleCreateAccount = async (p: UserProfile, email: string, password: string): Promise<string | null> => {
    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      console.error('[handleCreateAccount] auth.signUp error:', JSON.stringify(authError));
      const msg = authError.message ?? '';
      if (
        msg.includes('already registered') ||
        msg.includes('User already registered') ||
        msg.includes('already been registered')
      ) {
        return 'An account with this email already exists. Please sign in instead.';
      }
      return msg || 'Signup failed. Please try again.';
    }

    const userId = authData.user?.id;
    if (!userId) return 'Signup failed — no user returned. Please try again.';

    // signUp with email confirmation OFF automatically sets the session in the
    // client — no need to call setSession, which can clear-and-restore the
    // session mid-flight and cause the insert below to run unauthenticated.

    // 2. Insert the profile row — fire and forget; never block signup on this.
    // Schema cache mismatches or column errors are logged but ignored so the
    // user always proceeds to pricing after a successful auth.signUp.
    const { error: profileError } = await supabase.from('profiles').insert({
      id:           userId,
      email:        email,
      name:         p.name,
      age:          p.age,
      gender:       p.gender,
      height_cm:    p.heightCm,
      weight_kg:    p.currentWeightKg,
      goal_weight:  p.goalWeightKg,
      activity:     p.activityLevel,
      goal:         p.goal,
      subscription: 'free',
      onboarded:    false,
    });

    if (profileError) {
      console.error('[handleCreateAccount] profile insert error — code:', profileError.code, '| message:', profileError.message, '| hint:', profileError.hint, '| full:', JSON.stringify(profileError));
      // Do NOT return an error — auth succeeded, proceed regardless.
    }

    // 3. Both succeeded — update local state and proceed to pricing
    setProfile(p);
    storage.setUserProfile(p);
    setCurrentUserId(authData.user!.id);
    setCurrentUserEmail(email);

    // Wait for Supabase to establish the session before navigating to pricing
    const { data: { session: newSession } } = await supabase.auth.getSession();
    if (!newSession) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setScreen('onboarding-pricing');
    return null;
  };

  const handleSelectPlan = async (plan: SubscriptionStatus, meta?: { currency: string; amount: number }) => {
    setPaymentMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const userId = session?.user?.id || currentUserId;
      const userEmail = session?.user?.email || currentUserEmail;

      if (!userId) {
        setPaymentMessage('Please sign in to subscribe.');
        return;
      }

      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const accessToken = session?.access_token ?? anonKey;
      const fnUrl       = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/pesapal-order`;
      const orderId     = `WEB-${userId.replace(/-/g, '').slice(0, 12).toUpperCase()}-${Date.now()}`;

      // Call edge function with explicit Bearer token — mirrors mobile fetch approach
      const res = await fetch(fnUrl, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Apikey':        anonKey,
        },
        body: JSON.stringify({
          merchant_reference: orderId,
          currency:           meta?.currency ?? 'USD',
          amount:             meta?.amount   ?? 0,
          email:              userEmail,
          description:        `WeGoFit ${plan === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
          first_name:         profile?.name?.split(' ')[0]               ?? '',
          last_name:          profile?.name?.split(' ').slice(1).join(' ') ?? '',
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData?.redirect_url) {
        throw new Error(orderData?.error ?? orderData?.message ?? `Payment error (${res.status}). Please try again.`);
      }

      // Record a PENDING subscription — IPN webhook sets status to "active" after confirmed payment
      await supabase.from('subscriptions').upsert({
        user_id:          userId,
        email:            userEmail,
        plan,
        currency:         meta?.currency ?? 'USD',
        amount:           meta?.amount   ?? 0,
        status:           'pending',
        pesapal_order_id: orderId,
        start_date:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Open payment page in new tab
      window.open(orderData.redirect_url, '_blank');
      setPaymentMessage('Payment page opened. Complete your payment then click Check Payment Status');
    } catch (err) {
      setPaymentMessage((err as Error).message || 'Payment setup failed. Please try again.');
    }
  };

  const handleMaybeLater = () => {
    storage.setSubscription('free');
    storage.setOnboardingComplete(true);
    setScreen('home');
  };

  const handleUpgrade = () => setScreen('pricing');

  const handleTabChange = (tab: NavTab) => { setActiveTab(tab); setScreen('home'); };

  // ── Onboarding screens ──────────────────────────────────────────────────────
  if (screen === 'splash')
    return <SplashScreen onDone={handleSplashDone} />;

  if (screen === 'sign-in')
    return (
      <SignInScreen
        isRecovery={isRecovery}
        onSignInSuccess={(p) => {
          setIsRecovery(false);
          setProfile(p);
          setScreen('home');
        }}
        onCreateAccount={() => { setIsRecovery(false); setScreen('coach-welcome'); }}
        onRecoveryDone={() => { setIsRecovery(false); }}
      />
    );

  if (screen === 'coach-welcome')
    return <CoachWelcomeScreen onDone={handleCoachWelcomeDone} />;

  if (screen === 'onboarding-goal')
    return <OnboardingGoal onNext={handleGoalSelected} initialGoal={onboardingGoal || null} />;

  if (screen === 'onboarding-challenge')
    return (
      <OnboardingChallenge
        onNext={handleChallengeSelected}
        onBack={() => setScreen('onboarding-goal')}
        initialChallenge={onboardingChallenge || undefined}
      />
    );

  if (screen === 'onboarding-measurements')
    return (
      <OnboardingAboutB
        onNext={handleMeasurementsDone}
        onBack={() => setScreen('onboarding-challenge')}
        initialHeightCm={onboardingHeightCm}
        initialWeightKg={onboardingWeightKg}
        initialGoalWeightKg={onboardingGoalWeightKg}
        initialActivity={onboardingActivity}
        initialGender={onboardingGender}
        initialAge={onboardingAge}
      />
    );

  if (screen === 'onboarding-plan-preview') {
    const calories = calcDailyCalories(
      onboardingAge, onboardingGender, onboardingHeightCm,
      onboardingWeightKg, onboardingGoalWeightKg, onboardingActivity,
    );
    return (
      <PlanPreview
        goal={onboardingGoal}
        dailyCalories={calories}
        goalWeightKg={onboardingGoalWeightKg}
        onNext={() => setScreen('onboarding-create-account')}
      />
    );
  }

  if (screen === 'onboarding-create-account')
    return (
      <OnboardingAbout
        goal={onboardingGoal}
        age={onboardingAge}
        gender={onboardingGender}
        heightCm={onboardingHeightCm}
        currentWeightKg={onboardingWeightKg}
        goalWeightKg={onboardingGoalWeightKg}
        activityLevel={onboardingActivity}
        onNext={handleCreateAccount}
        onBack={() => setScreen('onboarding-plan-preview')}
      />
    );

  if (screen === 'onboarding-pricing')
    return (
      <PricingPage
        isOnboarding
        onSelectPlan={handleSelectPlan}
        onMaybeLater={handleMaybeLater}
        externalMessage={paymentMessage}
      />
    );

  // ── Guard ───────────────────────────────────────────────────────────────────
  if (!profile) return null;

  // ── Main app ────────────────────────────────────────────────────────────────
  const renderTab = () => {
    if (screen === 'pricing') {
      return (
        <PricingPage
          onSelectPlan={handleSelectPlan}
          onBack={() => setScreen('home')}
          externalMessage={paymentMessage}
        />
      );
    }
    switch (activeTab) {
      case 'home':      return <Dashboard profile={profile} onNavigate={(tab) => setActiveTab(tab as NavTab)} onOpenDiary={() => setActiveTab('nutrition')} />;
      case 'nutrition': return <FoodDiary profile={profile} />;
      case 'train':     return <WorkoutScreen onBack={() => setActiveTab('train')} onGoHome={() => { setActiveTab('home'); setScreen('home'); }} />;
      case 'coach':     return <CoachChat subscription={subscription} onUpgrade={handleUpgrade} />;
      case 'profile':   return <ProfilePage profile={profile} subscription={subscription} onUpgrade={handleUpgrade} />;
    }
  };

  return (
    <div className="relative bg-navy-900 min-h-screen max-w-lg mx-auto">
      {renderTab()}
      {screen !== 'pricing' && <BottomNav active={activeTab} onChange={handleTabChange} />}
      {screen === 'pricing' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto">
          <BottomNav active={activeTab} onChange={(tab) => { setScreen('home'); setActiveTab(tab); }} />
        </div>
      )}
    </div>
  );
}
