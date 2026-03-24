import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Dumbbell, User } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const TRAINER_FAQS: FAQItem[] = [
  {
    question: 'What is FitRush?',
    answer:
      'FitRush is a marketplace that connects certified personal trainers with clients during off-peak and open hours. You set your availability, set your rates, and we bring the clients to you.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Sign up, upload your certifications, complete your profile, and set your availability. Once your credentials are verified, you will appear in client searches and can start accepting bookings.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'You set your own rates. FitRush applies a small platform fee on each booking. The rest goes directly to your connected Stripe account. No surprise deductions.',
  },
  {
    question: 'When and how do I get paid?',
    answer:
      'Payouts are processed weekly to your Stripe account once your balance reaches $50. You can also request a manual payout from your dashboard at any time.',
  },
  {
    question: 'Can I use FitRush alongside my existing clients?',
    answer:
      'Absolutely. FitRush is designed to fill your open hours, not replace your current schedule. Sync your Google Calendar to avoid double bookings and keep everything in one place.',
  },
  {
    question: 'Can I keep clients I meet through FitRush?',
    answer:
      'Of course. We cannot control a great match, and we would not want to. FitRush is here to fill the gaps. When someone cancels last minute or you have idle hours between sessions, we connect you with clients who need training right now. Think of it as turning dead time into income instead of sitting around waiting.',
  },
  {
    question: 'What certifications do you accept?',
    answer:
      'We accept nationally recognized certifications including NASM, ACE, ISSA, NSCA, and ACSM. Upload your credentials during onboarding and our team reviews them within 2 to 5 business days.',
  },
];

const CLIENT_FAQS: FAQItem[] = [
  {
    question: 'Who is FitRush for?',
    answer:
      'Anyone who values flexibility. Whether you are a frequent traveler who cannot commit to a fixed gym schedule, a busy professional with unpredictable hours, or simply someone who prefers booking training on your own terms, FitRush is built for you.',
  },
  {
    question: 'How does booking work?',
    answer:
      'Search for trainers near you, browse their profiles and reviews, pick an available time slot, and book instantly. Your trainer comes to you: hotel gym, park, private gym, wherever works.',
  },
  {
    question: 'What are "signature hours"?',
    answer:
      'Signature hours are a trainer\'s open windows, times when they are available but not fully booked. Rates during these hours reflect the flexibility of the schedule, not a compromise on quality. You get world-class coaching on your timeline.',
  },
  {
    question: 'Can I book a trainer while traveling?',
    answer:
      'Yes, and that is one of the best parts. Traveling for work and want to keep your routine? Search trainers in your destination city, book a session at your hotel gym, and train with a certified local pro. No packing your PT in your luggage required.',
  },
  {
    question: 'Is this only for experienced gym-goers?',
    answer:
      'Not at all. FitRush trainers work with every fitness level, from first-timers to competitive athletes. Your Fitness Passport helps trainers understand your goals and history so every session picks up right where you left off.',
  },
  {
    question: 'How do payments work?',
    answer:
      'You pay securely through Stripe at the time of booking. No card details are stored on FitRush. If you cancel more than 24 hours before your session, you get a full refund.',
  },
];

const AccordionItem: React.FC<{
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ item, isOpen, onToggle }) => (
  <div className="border-b border-ink/8">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-5 text-left group"
    >
      <span className="text-sm font-medium text-ink pr-4 group-hover:text-accent transition-colors">
        {item.question}
      </span>
      <motion.span
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.25 }}
        className="shrink-0"
      >
        <ChevronDown size={14} className="text-ink/30" />
      </motion.span>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <p className="text-sm text-ink/60 leading-relaxed pb-5">
            {item.answer}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const FAQColumn: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: FAQItem[];
  accentClass?: string;
}> = ({ title, subtitle, icon, items, accentClass = 'text-accent' }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="border border-ink/10">
      <div className="px-6 sm:px-8 py-8 border-b border-ink/10">
        <div className="flex items-center gap-3 mb-3">
          <span className={accentClass}>{icon}</span>
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-medium text-ink/40">
            {subtitle}
          </h2>
        </div>
        <p className="text-xl serif font-light italic text-ink">{title}</p>
      </div>
      <div className="px-6 sm:px-8">
        {items.map((item, i) => (
          <AccordionItem
            key={i}
            item={item}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
};

const FAQ: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-12 h-px bg-accent mx-auto" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-ink/40 font-medium">
            Everything You Need to Know
          </p>
          <h1 className="text-3xl sm:text-4xl serif font-light italic text-ink">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-ink/50 max-w-lg mx-auto">
            Whether you are a trainer looking to fill open hours or a client seeking flexible training, here is how FitRush works.
          </p>
        </div>

        {/* Two-column FAQ grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <FAQColumn
            title="For Trainers"
            subtitle="The Collective"
            icon={<Dumbbell size={16} strokeWidth={1.5} />}
            items={TRAINER_FAQS}
            accentClass="text-accent"
          />
          <FAQColumn
            title="For Clients"
            subtitle="Your Training, Your Terms"
            icon={<User size={16} strokeWidth={1.5} />}
            items={CLIENT_FAQS}
            accentClass="text-ink/60"
          />
        </div>

        {/* Bottom CTA */}
        <div className="text-center space-y-4 pt-8">
          <div className="w-8 h-px bg-ink/10 mx-auto" />
          <p className="text-sm text-ink/40">Still have questions?</p>
          <a
            href="mailto:support@fitrush.com"
            onClick={(e) => { e.preventDefault(); window.location.href = 'mailto:sirxiii@gmail.com?subject=FitRush Support'; }}
            className="inline-block border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
