import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Mike Reynolds',
    specialty: 'Strength & Conditioning',
    photo: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=400&q=80',
    quote:
      'I used to have dead hours between 1 and 4 PM. Now I fill them through FitRush — same gym, same quality, just smarter scheduling. My income went up without adding a single peak-hour client.',
  },
  {
    name: 'Jennifer Park',
    specialty: 'HIIT & Functional Training',
    photo: 'https://images.unsplash.com/photo-1609899464726-209befab8e0c?auto=format&fit=crop&w=400&q=80',
    quote:
      'As a newly certified trainer, building a client base felt impossible. FitRush connected me with clients during my open hours. Now my peak slots are full too — FitRush was the launchpad.',
  },
  {
    name: 'Brad Kowalski',
    specialty: 'Athletic Performance',
    photo: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80',
    quote:
      'I set my availability, FitRush handles the rest. Clients book my off-peak windows at preferred rates, and I generate income during hours I\'d otherwise be idle. It\'s the smartest tool in my business.',
  },
];

const TrainerTestimonials: React.FC = () => {
  return (
    <section className="bg-paper py-28 px-6 sm:px-10 lg:px-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="space-y-4 mb-16"
        >
          <div className="w-12 h-[1px] bg-accent" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-ink/40 font-medium">
            From the Collective
          </p>
          <h2 className="text-3xl md:text-4xl serif font-light italic text-ink">
            What Trainers Say
          </h2>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="space-y-6"
            >
              {/* Quote icon */}
              <Quote size={20} className="text-accent/40" strokeWidth={1.5} />

              {/* Quote text */}
              <p className="text-sm serif italic text-ink/70 leading-relaxed">
                "{t.quote}"
              </p>

              {/* Accent line */}
              <div className="w-8 h-[1px] bg-accent/30" />

              {/* Trainer info */}
              <div className="flex items-center gap-4">
                <img
                  src={t.photo}
                  alt={t.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-ink">{t.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40">
                    {t.specialty}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrainerTestimonials;
