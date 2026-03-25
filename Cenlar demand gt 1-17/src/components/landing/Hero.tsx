import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { waitlistSchema } from '../../lib/schemas';

type HeroState = 'idle' | 'submitted';

const stepVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const Hero: React.FC = () => {
  const [heroState, setHeroState] = useState<HeroState>('idle');
  const [intent, setIntent] = useState<'client' | 'trainer' | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToSearch = () => {
    const element = document.getElementById('search');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  void scrollToSearch; // kept for potential external use

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = waitlistSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid email');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/waitlist-signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: result.data.email, intent }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Signup failed');
      }
      setHeroState('submitted');
      toast.success('You are on the early access list.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      toast.error('Could not sign you up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center bg-paper pt-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-7 z-10">
            <AnimatePresence mode="wait">
              {heroState === 'idle' && (
                <motion.div
                  key="idle"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                  className="space-y-10 relative"
                >
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase tracking-[0.4em] font-semibold text-accent block">
                      Elite Fitness Marketplace
                    </span>
                    <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl serif font-normal md:font-light leading-[0.9] tracking-[-0.02em] text-ink">
                      Book Elite Trainers{' '}
                      <br className="hidden sm:block" />
                      <span className="italic">at Off-Peak Hours.</span>{' '}
                      <span className="text-accent">24/7</span>
                    </h1>
                  </div>

                  <p className="text-lg md:text-xl text-[#4A4B4D] font-light leading-relaxed max-w-md">
                    Certified trainers with open availability. Off-peak hours, preferred rates.
                  </p>

                  {/* Intent selector */}
                  <div className="flex gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setIntent('client')}
                      className={`px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium border transition-all duration-300 ${
                        intent === 'client'
                          ? 'bg-ink text-white border-ink'
                          : 'bg-transparent text-ink/60 border-ink/20 hover:border-ink/40'
                      }`}
                    >
                      I'm looking for a trainer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntent('trainer')}
                      className={`px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] font-medium border transition-all duration-300 ${
                        intent === 'trainer'
                          ? 'bg-ink text-white border-ink'
                          : 'bg-transparent text-ink/60 border-ink/20 hover:border-ink/40'
                      }`}
                    >
                      I'm a trainer
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-4 pt-4 transition-opacity duration-300 ${intent ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        placeholder="Enter your email"
                        disabled={loading}
                        className="w-full bg-[#FAFAFA] focus:bg-[#F0F0F0] border-b border-ink/20 focus:border-ink px-4 py-4 text-ink placeholder:text-[#6B6D70] text-sm tracking-wide outline-none transition-all duration-300"
                      />
                      {error && <p className="text-red-600 text-xs mt-2 tracking-wide">{error}</p>}
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-ink text-white px-12 py-4 text-[11px] uppercase tracking-[0.3em] hover:bg-accent transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {loading ? 'Joining...' : 'Get Early Access'}
                    </button>
                  </form>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-12 pt-16 border-t border-ink/5">
                    <div className="space-y-1">
                      <div className="text-2xl serif font-light italic">Vetted</div>
                      <div className="text-[9px] uppercase tracking-widest text-ink/40">Certified Trainers</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl serif font-light italic">Up to 40%</div>
                      <div className="text-[9px] uppercase tracking-widest text-ink/40">Off-Peak Rates</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl serif font-light italic">Verified</div>
                      <div className="text-[9px] uppercase tracking-widest text-ink/40">Client Reviews</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {heroState === 'submitted' && (
                <motion.div
                  key="submitted"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                  className="space-y-10 relative"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-[1px] bg-accent"></div>
                    <span className="text-[10px] uppercase tracking-[0.4em] font-semibold text-accent block">
                      Early Access
                    </span>
                    <h2 className="text-4xl md:text-6xl lg:text-7xl serif font-normal md:font-light leading-[0.9] tracking-tight text-ink">
                      You're <br />
                      <span className="italic">In.</span>
                    </h2>
                  </div>
                  <p className="text-lg md:text-xl text-ink/80 md:text-ink/60 font-light leading-relaxed max-w-md">
                    Welcome to FitRush. You are on the early access list. We will reach out when it is time.
                  </p>
                  <div className="w-12 h-[1px] bg-accent"></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5 relative hidden sm:block">
            <motion.div
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5 }}
              className="relative aspect-[4/5] overflow-hidden"
            >
              <img
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80"
                alt="Luxury Fitness"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover hover:scale-105 transition-all duration-1000"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="absolute -bottom-10 left-32 bg-paper/95 p-10 border border-ink/5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] hidden md:block"
            >
              <div className="space-y-4">
                <div className="w-12 h-[1px] bg-accent"></div>
                <p className="text-sm italic serif text-[#222222] max-w-[200px] leading-relaxed">
                  "The most seamless way to access world-class coaching without the premium overhead."
                </p>
                <p className="text-[10px] uppercase tracking-widest text-ink/50 font-bold">— Architectural Fitness</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Decorative vertical line */}
      <div className="absolute right-12 top-0 h-full w-[1px] bg-ink/5 hidden lg:block"></div>
    </section>
  );
};

export default Hero;
