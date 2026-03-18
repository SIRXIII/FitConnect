import { motion } from 'framer-motion';

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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="space-y-10 relative"
            >
              <div className="space-y-4">
                <span className="text-[10px] uppercase tracking-[0.4em] font-semibold text-accent block">
                  Elite Fitness Marketplace
                </span>
                <h1 className="text-5xl md:text-8xl lg:text-9xl serif font-normal md:font-light leading-[0.9] tracking-tight text-ink">
                  Refined <br />
                  <span className="italic">Strength.</span>
                </h1>
              </div>

              <p className="text-lg md:text-xl text-ink/80 md:text-ink/60 font-light leading-relaxed max-w-md">
                Connecting discerning individuals with certified master trainers during exclusive downtime hours.
              </p>

              <div className="flex flex-col sm:flex-row gap-8 pt-6">
                <button
                  onClick={scrollToSearch}
                  className="bg-ink text-white px-12 py-5 text-[11px] uppercase tracking-[0.3em] hover:bg-accent transition-all duration-500"
                >
                  Discover Trainers
                </button>
                <button className="text-ink px-4 py-5 text-[11px] uppercase tracking-[0.3em] border-b border-ink/20 hover:border-ink transition-all">
                  The Experience
                </button>
              </div>

              <div className="grid grid-cols-3 gap-12 pt-16 border-t border-ink/5">
                <div className="space-y-1">
                  <div className="text-2xl serif font-light italic">2,000+</div>
                  <div className="text-[9px] uppercase tracking-widest text-ink/40">Professionals</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl serif font-light italic">Smart</div>
                  <div className="text-[9px] uppercase tracking-widest text-ink/40">Pricing</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl serif font-light italic">4.9</div>
                  <div className="text-[9px] uppercase tracking-widest text-ink/40">Excellence Score</div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-5 relative">
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
              className="absolute -bottom-10 left-32 bg-paper p-10 border border-ink/5 hidden md:block"
            >
              <div className="space-y-4">
                <div className="w-12 h-[1px] bg-accent"></div>
                <p className="text-xs italic serif text-ink/80 max-w-[180px] leading-relaxed">
                  "The most seamless way to access world-class coaching without the premium overhead."
                </p>
                <p className="text-[9px] uppercase tracking-widest text-ink/40">— Architectural Fitness</p>
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
