import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { clientProfileSchema } from '@/lib/schemas';
import { isNativeiOS } from '@/lib/platform';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripeKey && !isNativeiOS() ? loadStripe(stripeKey) : null;

// ─── types ────────────────────────────────────────────────
interface FormData {
  full_name: string;
  age: string;
  weight_lbs: string;
  height_ft: string;
  height_in: string;
  body_type: string;
  fitness_level: string;
  fitness_goals: string[];
  workout_types: string[];
  preferred_session_length: number;
  health_notes: string;
}

const GOALS = [
  'Weight Loss', 'Build Muscle', 'Improve Endurance', 'Increase Flexibility',
  'Stress Relief', 'Athletic Performance', 'General Fitness', 'Rehab & Recovery',
];
const WORKOUT_TYPES = [
  'Strength Training', 'HIIT', 'Cardio', 'Yoga / Pilates',
  'Boxing / Kickboxing', 'Outdoor Training', 'Stretching & Mobility', 'Sport-Specific',
];
const SESSION_LENGTHS = [30, 45, 60, 90];
const BODY_TYPES = [
  { value: 'slim', label: 'Slim', desc: 'Lean build, difficulty gaining weight' },
  { value: 'average', label: 'Average', desc: 'Moderate build, balanced proportions' },
  { value: 'athletic', label: 'Athletic', desc: 'Muscular, active lifestyle' },
  { value: 'heavy', label: 'Heavy', desc: 'Larger build, focus on health goals' },
];
const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'New to structured training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years of consistent training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years, sport or performance focus' },
];

// ─── Payment step (inner Stripe component) ────────────────
const PaymentStep: React.FC<{ clientSecret: string; onSuccess: (pmId: string, last4: string, brand: string) => void; onSkip: () => void }> = ({ clientSecret, onSuccess, onSkip }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    const { setupIntent, error } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });
    if (error) {
      toast.error(error.message ?? 'Payment setup failed');
      setSaving(false);
      return;
    }
    const pmId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id ?? '';
    // Fetch last4 & brand
    try {
      const pm = await stripe.retrievePaymentMethod(pmId) as { paymentMethod?: { card?: { last4?: string; brand?: string } } };
      const last4 = pm?.paymentMethod?.card?.last4 ?? '••••';
      const brand = pm?.paymentMethod?.card?.brand ?? 'card';
      onSuccess(pmId, last4, brand);
    } catch {
      onSuccess(pmId, '••••', 'card');
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <PaymentElement />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || !stripe}
          className="flex-1 bg-ink text-white py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : 'Save Card'}
        </button>
        <button type="button" onClick={onSkip} className="text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-ink transition-colors">
          Skip for now
        </button>
      </div>
    </form>
  );
};

// ─── Main component ────────────────────────────────────────
const ClientOnboarding: React.FC = () => {
  const { user, profile, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = stripePromise ? 6 : 5;

  const [form, setForm] = useState<FormData>({
    full_name: profile?.full_name ?? '',
    age: '',
    weight_lbs: '',
    height_ft: '',
    height_in: '',
    body_type: '',
    fitness_level: '',
    fitness_goals: [],
    workout_types: [],
    preferred_session_length: 60,
    health_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{ pmId: string; last4: string; brand: string } | null>(null);

  const toggle = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const loadSetupIntent = async () => {
    if (!stripePromise || setupClientSecret) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-setup-intent`,
        { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      const json = await res.json();
      if (json.clientSecret) setSetupClientSecret(json.clientSecret);
    } catch (err) {
      console.error('[ClientOnboarding] setup intent error:', err);
    }
  };

  const handleNext = async () => {
    if (step === 5 && stripePromise) {
      await loadSetupIntent();
      setStep(6);
      return;
    }
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    await saveProfile(null);
  };

  const saveProfile = async (payment: typeof paymentData) => {
    if (!user) return;
    setSaving(true);
    try {
      // Validate with Zod before saving
      const validation = clientProfileSchema.safeParse({
        full_name: form.full_name.trim(),
        age: form.age ? parseInt(form.age) : undefined,
        weight_lbs: form.weight_lbs ? parseFloat(form.weight_lbs) : undefined,
        height_feet: form.height_ft ? parseInt(form.height_ft) : undefined,
        height_inches: form.height_in ? parseInt(form.height_in) : undefined,
        fitness_level: form.fitness_level || undefined,
        health_notes: form.health_notes || undefined,
      });

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast.error(firstError.message);
        setSaving(false);
        return;
      }

      const profileUpdate: Record<string, unknown> = { onboarding_complete: true };
      if (form.full_name.trim()) profileUpdate.full_name = form.full_name.trim();
      await updateProfile(profileUpdate as Parameters<typeof updateProfile>[0]);

      const clientData: Record<string, unknown> = {
        user_id: user.id,
        fitness_goals: form.fitness_goals,
        workout_types: form.workout_types,
        preferred_session_length: form.preferred_session_length,
        health_notes: form.health_notes || null,
      };
      if (form.age) clientData.age = parseInt(form.age);
      if (form.weight_lbs) clientData.weight_lbs = parseFloat(form.weight_lbs);
      if (form.height_ft) clientData.height_ft = parseInt(form.height_ft);
      if (form.height_in) clientData.height_in = parseInt(form.height_in);
      if (form.body_type) clientData.body_type = form.body_type;
      if (form.fitness_level) clientData.fitness_level = form.fitness_level;
      if (payment) {
        clientData.stripe_payment_method_id = payment.pmId;
        clientData.stripe_payment_last4 = payment.last4;
        clientData.stripe_payment_brand = payment.brand;
      }

      const { error } = await supabase.from('client_profiles').upsert(clientData, { onConflict: 'user_id' });
      if (error) throw error;

      toast.success('Profile complete! Welcome to FitRush.');
      navigate('/trainers', { replace: true });
    } catch (err) {
      console.error('[ClientOnboarding] save error:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return form.full_name.trim().length > 0;
    if (step === 3) return !!form.body_type && !!form.fitness_level;
    if (step === 4) return form.fitness_goals.length > 0;
    if (step === 5) return form.workout_types.length > 0;
    return true;
  };

  const stepLabels = ['Name', 'Stats', 'Profile', 'Goals', 'Style', ...(stripePromise ? ['Payment'] : [])];

  return (
    <div className="min-h-screen bg-paper pt-24 pb-20 px-6">
      <div className="max-w-xl mx-auto space-y-10">

        {/* Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.3em] text-ink/40">
              Step {step} of {TOTAL_STEPS}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">{stepLabels[step - 1]}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 transition-colors duration-300 ${i < step ? 'bg-accent' : 'bg-ink/10'}`}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Name ── */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">What's your name?</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
                This is how trainers will see you
              </p>
            </div>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Full name"
              autoFocus
              className="w-full border-b border-ink/20 bg-transparent pb-3 text-xl font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
            />
          </div>
        )}

        {/* ── Step 2: Stats ── */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">Your measurements</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
                Helps trainers tailor sessions to you — optional
              </p>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Age</label>
                <input
                  type="number" min={13} max={99} value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                  placeholder="e.g. 28"
                  className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Weight (lbs)</label>
                <input
                  type="number" min={60} max={500} value={form.weight_lbs}
                  onChange={e => setForm(f => ({ ...f, weight_lbs: e.target.value }))}
                  placeholder="e.g. 165"
                  className="w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Height</label>
                <div className="flex gap-4">
                  <input
                    type="number" min={3} max={8} value={form.height_ft}
                    onChange={e => setForm(f => ({ ...f, height_ft: e.target.value }))}
                    placeholder="ft"
                    className="w-24 border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
                  />
                  <input
                    type="number" min={0} max={11} value={form.height_in}
                    onChange={e => setForm(f => ({ ...f, height_in: e.target.value }))}
                    placeholder="in"
                    className="w-24 border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Body type & fitness level ── */}
        {step === 3 && (
          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">Body type & fitness level</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">Select one of each</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Body Type</p>
                <div className="grid grid-cols-2 gap-3">
                  {BODY_TYPES.map(bt => (
                    <button
                      key={bt.value}
                      onClick={() => setForm(f => ({ ...f, body_type: bt.value }))}
                      className={`text-left p-4 border transition-all ${form.body_type === bt.value ? 'border-accent bg-accent/5' : 'border-ink/10 hover:border-ink/30'}`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.15em] font-semibold">{bt.label}</p>
                      <p className="text-[11px] text-ink/40 mt-1 font-light">{bt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Fitness Level</p>
                <div className="space-y-2">
                  {FITNESS_LEVELS.map(fl => (
                    <button
                      key={fl.value}
                      onClick={() => setForm(f => ({ ...f, fitness_level: fl.value }))}
                      className={`w-full text-left p-4 border transition-all flex items-center justify-between ${form.fitness_level === fl.value ? 'border-accent bg-accent/5' : 'border-ink/10 hover:border-ink/30'}`}
                    >
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold">{fl.label}</p>
                        <p className="text-[11px] text-ink/40 font-light mt-0.5">{fl.desc}</p>
                      </div>
                      {form.fitness_level === fl.value && <Check size={14} className="text-accent flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Goals ── */}
        {step === 4 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">What are your goals?</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">Select all that apply</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map(goal => (
                <button
                  key={goal}
                  onClick={() => setForm(f => ({ ...f, fitness_goals: toggle(f.fitness_goals, goal) }))}
                  className={`relative text-left p-4 border transition-all ${form.fitness_goals.includes(goal) ? 'border-accent bg-accent/5' : 'border-ink/10 hover:border-ink/30'}`}
                >
                  <p className="text-[11px] uppercase tracking-[0.1em] font-medium pr-5">{goal}</p>
                  {form.fitness_goals.includes(goal) && (
                    <Check size={12} className="text-accent absolute top-4 right-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 5: Workout style ── */}
        {step === 5 && (
          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">Your workout style</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">Select all that interest you</p>
            </div>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-3">
                {WORKOUT_TYPES.map(wt => (
                  <button
                    key={wt}
                    onClick={() => setForm(f => ({ ...f, workout_types: toggle(f.workout_types, wt) }))}
                    className={`relative text-left p-4 border transition-all ${form.workout_types.includes(wt) ? 'border-accent bg-accent/5' : 'border-ink/10 hover:border-ink/30'}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.1em] font-medium pr-5">{wt}</p>
                    {form.workout_types.includes(wt) && (
                      <Check size={12} className="text-accent absolute top-4 right-4" />
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Preferred session length</p>
                <div className="flex gap-3">
                  {SESSION_LENGTHS.map(len => (
                    <button
                      key={len}
                      onClick={() => setForm(f => ({ ...f, preferred_session_length: len }))}
                      className={`flex-1 py-3 border text-[11px] uppercase tracking-[0.15em] font-medium transition-all ${form.preferred_session_length === len ? 'border-accent bg-accent/5 text-accent' : 'border-ink/10 hover:border-ink/30 text-ink/60'}`}
                    >
                      {len}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                  Health notes <span className="normal-case">(injuries, limitations, anything trainers should know)</span>
                </p>
                <textarea
                  value={form.health_notes}
                  onChange={e => setForm(f => ({ ...f, health_notes: e.target.value }))}
                  rows={3}
                  placeholder="e.g. Previous ACL surgery, avoid high-impact on left knee"
                  className="w-full border border-ink/15 bg-transparent p-4 text-sm font-light outline-none focus:border-ink/40 transition-colors placeholder:text-ink/20 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Payment ── */}
        {step === 6 && stripePromise && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-3xl serif font-light italic">Add a payment method</h2>
              <p className="text-xs uppercase tracking-[0.25em] text-ink/40">
                Securely saved for instant booking — powered by Stripe
              </p>
            </div>
            {setupClientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret, appearance: { theme: 'flat', variables: { fontFamily: 'Inter, sans-serif', colorPrimary: '#1a1a1a' } } }}>
                <PaymentStep
                  clientSecret={setupClientSecret}
                  onSuccess={(pmId, last4, brand) => {
                    setPaymentData({ pmId, last4, brand });
                    saveProfile({ pmId, last4, brand });
                  }}
                  onSkip={() => saveProfile(null)}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        {step < 6 && (
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink/40 hover:text-ink transition-colors"
            >
              <ChevronLeft size={14} />
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className="px-10 py-3 bg-ink text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : step === TOTAL_STEPS ? 'Finish' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientOnboarding;
