import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Phone, X } from 'lucide-react';

const partners = [
  {
    id: 'nasm',
    name: 'NASM',
    program: 'Approved Performance Facility',
    seal: '/assets/partners/nasm-approved-facility.png',
    blurb: 'FitRush is a NASM Approved Performance Facility and Preferred Partner. Our community trains with professionals held to the highest standard in the industry.',
  },
  {
    id: 'afaa',
    name: 'AFAA',
    program: 'Group Fitness Partner',
    seal: '/assets/partners/afaa-group-fitness-partner.jpg',
    blurb: 'Through our AFAA partnership, FitRush supports world-class group fitness instruction and education for our trainers and members.',
  },
] as const;

type Partner = (typeof partners)[number];

const certifications = [
  'Certified Personal Trainer (NASM-CPT)',
  'Corrective Exercise Specialist (NASM-CES)',
  'Performance Enhancement Specialization (NASM-PES)',
  'Behavior Change Specialist (NASM-BCS)',
  'Certified Nutrition Coach (NASM-CNC)',
  'Certified Group Fitness Instructor (AFAA-GFI)',
  'and more',
];

const Partners: React.FC = () => {
  const [selected, setSelected] = useState<Partner | null>(null);

  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  return (
    <>
      <section id="partners" className="py-32 bg-paper border-t border-ink/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="space-y-6 max-w-lg">
              <p className="text-xs uppercase tracking-[0.3em] font-semibold text-accent">Official Partners</p>
              <h2 className="text-4xl sm:text-5xl serif font-light italic text-ink leading-tight">
                Recognized by the industry's leading certification bodies.
              </h2>
              <p className="text-sm text-ink/50 leading-relaxed font-light">
                FitRush is proud to be a NASM and AFAA Preferred Partner. Select a seal to learn what this means for you.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:justify-end items-center gap-12 sm:gap-20">
              {partners.map((partner) => (
                <button
                  key={partner.id}
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Learn about our ${partner.name} ${partner.program} partnership`}
                  onClick={() => setSelected(partner)}
                  className="flex flex-col items-center gap-4 group active:scale-[0.98] transition-transform"
                >
                  <img
                    src={partner.seal}
                    alt={`${partner.name} ${partner.program} seal`}
                    className="h-32 md:h-40 object-contain mix-blend-multiply grayscale group-hover:grayscale-0 group-hover:scale-105 transition duration-300"
                  />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent">
                    {partner.name} {partner.program}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-label={`${selected.name} ${selected.program}`}
              className="relative bg-paper border border-ink/10 max-w-md w-full p-8 space-y-6 max-h-[85vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="absolute top-6 right-6 text-ink/30 hover:text-ink transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>

              <div className="space-y-4">
                <img
                  src={selected.seal}
                  alt={`${selected.name} ${selected.program} seal`}
                  className="h-24 object-contain mix-blend-multiply"
                />
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent">Preferred Partner</p>
                  <h3 className="text-2xl serif font-light italic text-ink">
                    {selected.name} {selected.program}
                  </h3>
                  <p className="text-sm text-ink/50 leading-relaxed font-light">{selected.blurb}</p>
                </div>
              </div>

              <p className="text-base serif italic text-ink leading-relaxed border-t border-ink/10 pt-6">
                When you join us, you automatically get our partnership signature rate on industry-leading certifications. As a Preferred Partner, we extend this benefit to our trainers, members, and community.
              </p>

              <div className="divide-y divide-ink/5 border-t border-ink/5">
                {certifications.map((cert) => (
                  <p key={cert} className="py-2.5 text-sm text-ink/60 font-light">
                    {cert}
                  </p>
                ))}
              </div>

              <div className="border-t border-ink/10 pt-6 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent">Get Started Today</p>
                <p className="text-sm text-ink/70">Kim Aquilo, NASM Partner Representative</p>
                <div className="-mx-2">
                  <a
                    href="tel:+16027075385"
                    className="flex items-center gap-3 px-2 py-3 text-sm text-ink/60 hover:text-accent transition-colors"
                  >
                    <Phone size={16} strokeWidth={1.5} />
                    602-707-5385
                  </a>
                  <a
                    href="mailto:Kim.Aquilo@nasm.org"
                    className="flex items-center gap-3 px-2 py-3 text-sm text-ink/60 hover:text-accent transition-colors"
                  >
                    <Mail size={16} strokeWidth={1.5} />
                    Kim.Aquilo@nasm.org
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Partners;
