import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { nominationSchema } from '@/lib/schemas';
import { US_STATES } from '@/lib/usStates';

const NominateTrainer: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [showNominee, setShowNominee] = useState(false);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeEmail, setNomineeEmail] = useState('');
  const [nomineePhone, setNomineePhone] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [votedCity, setVotedCity] = useState('');
  const [cityCount, setCityCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = nominationSchema.safeParse({
      first_name: firstName,
      city,
      state,
      nominee_name: nomineeName,
      nominee_email: nomineeEmail,
      nominee_phone: nomineePhone,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nominate-trainer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(result.data),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? 'Could not submit your nomination');
      }

      setVotedCity(result.data.city);
      setCityCount(typeof body.cityCount === 'number' ? body.cityCount : null);
      setSubmitted(true);
      toast.success('Nomination received.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
        <div className="max-w-lg mx-auto text-center space-y-6 pt-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-full">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-ink mb-2">Nomination Received</h2>
            <p className="text-sm text-ink/50">
              {cityCount !== null
                ? <>You're vote #{cityCount} for <span className="capitalize">{votedCity}</span>.</>
                : <>Thanks for putting <span className="capitalize">{votedCity}</span> on the map.</>}
            </p>
            <p className="text-xs text-ink/30 mt-3">
              We use nomination counts to decide where to recruit trainers next.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl serif font-light italic text-ink mb-1">
            Want FitRush trainers in your city?
          </h1>
          <p className="text-sm text-ink/50">
            Every nomination raises your city's demand count and helps us recruit there.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={80}
              placeholder="Your first name"
              className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
            />
            {fieldErrors.first_name && (
              <p className="text-red-600 text-xs mt-2 tracking-wide">{fieldErrors.first_name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
              State
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            >
              <option value="">Select a state</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {fieldErrors.state && (
              <p className="text-red-600 text-xs mt-2 tracking-wide">{fieldErrors.state}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              placeholder="Your city"
              className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
            />
            {fieldErrors.city && (
              <p className="text-red-600 text-xs mt-2 tracking-wide">{fieldErrors.city}</p>
            )}
          </div>

          <div className="border-t border-ink/10 pt-5">
            <button
              type="button"
              onClick={() => setShowNominee((v) => !v)}
              className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
            >
              {showNominee ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Know a great trainer? Tell us who (optional)
            </button>

            {showNominee && (
              <div className="space-y-5 mt-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
                    Trainer Name
                  </label>
                  <input
                    type="text"
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                    maxLength={120}
                    placeholder="Their name"
                    className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
                  />
                  {fieldErrors.nominee_name && (
                    <p className="text-red-600 text-xs mt-2 tracking-wide">{fieldErrors.nominee_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
                    Trainer Email
                  </label>
                  <input
                    type="email"
                    value={nomineeEmail}
                    onChange={(e) => setNomineeEmail(e.target.value)}
                    maxLength={320}
                    placeholder="Their email"
                    className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
                  />
                  {fieldErrors.nominee_email && (
                    <p className="text-red-600 text-xs mt-2 tracking-wide">{fieldErrors.nominee_email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
                    Trainer Phone
                  </label>
                  <input
                    type="tel"
                    value={nomineePhone}
                    onChange={(e) => setNomineePhone(e.target.value)}
                    maxLength={40}
                    placeholder="Their phone number"
                    className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
                  />
                  {fieldErrors.nominee_phone && (
                    <p className="text-red-600 text-xs mt-2 tracking-wide">{fieldErrors.nominee_phone}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-accent text-white text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Submitting...' : 'Nominate My City'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NominateTrainer;
