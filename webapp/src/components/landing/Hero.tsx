import { motion } from 'framer-motion';
import AppStoreBadge from '@/components/shared/AppStoreBadge';

const Hero: React.FC = () => {
  const scrollToSearch = () => {
    const element = document.getElementById('search');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center bg-paper pt-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-7 z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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

              {/* items-start keeps each control sized to its content: as flex
                  items they would otherwise stretch, giving the badge a hit
                  area far wider than the artwork. */}
              <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 pt-6">
                <AppStoreBadge />
                <button
                  type="button"
                  onClick={scrollToSearch}
                  className="h-12 px-10 inline-flex items-center justify-center text-[11px] uppercase tracking-[0.3em] text-ink border border-ink/20 hover:border-ink hover:text-accent transition-all duration-500 whitespace-nowrap"
                >
                  Browse Trainers
                </button>
              </div>

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
