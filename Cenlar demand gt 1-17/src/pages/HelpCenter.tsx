import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, LifeBuoy, Ticket, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  category: string;
  icon: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    category: 'Booking',
    icon: '📅',
    items: [
      {
        question: 'How do I book a session?',
        answer:
          'Browse trainers on the homepage or search for trainers in your area. Click on a trainer\'s profile, choose an available time slot, and complete the booking. You\'ll receive a confirmation email once payment is processed.',
      },
      {
        question: 'What is the cancellation policy?',
        answer:
          'You can cancel a booking for a full refund up to 24 hours before the scheduled session. Cancellations made within 24 hours of the session are not eligible for a refund unless the trainer agrees to waive the fee.',
      },
      {
        question: 'Can I reschedule a session?',
        answer:
          'Rescheduling is handled directly with your trainer through the Messages section. Contact your trainer as early as possible to arrange an alternative time. The trainer can cancel the original booking so you can rebook at the new time.',
      },
      {
        question: 'What happens if my trainer cancels?',
        answer:
          'If a trainer cancels your session, you will receive a full refund to your original payment method within 5–10 business days. You\'ll also be notified by email and can rebook with the same or a different trainer.',
      },
    ],
  },
  {
    category: 'Payments',
    icon: '💳',
    items: [
      {
        question: 'How does billing work?',
        answer:
          'Payment is processed at the time of booking through our secure Stripe integration. The full session fee is charged immediately. Trainers receive their payout after the session is complete, minus the FitRush platform fee.',
      },
      {
        question: 'How do refunds work?',
        answer:
          'Refunds for eligible cancellations are issued to your original payment method. Processing time is 5–10 business days depending on your bank. You\'ll receive an email confirmation when the refund is issued.',
      },
      {
        question: 'Is my payment information secure?',
        answer:
          'Yes. All payments are processed by Stripe, a PCI-DSS Level 1 certified payment processor. FitRush never stores your full card number or sensitive payment data on our servers.',
      },
      {
        question: 'Are there any hidden fees?',
        answer:
          'The price shown on the trainer\'s profile is the total you pay. There are no booking fees or hidden charges added at checkout.',
      },
    ],
  },
  {
    category: 'Account',
    icon: '👤',
    items: [
      {
        question: 'How do I update my profile?',
        answer:
          'Go to your dashboard and click the profile settings icon. You can update your name, photo, bio, and contact information from there.',
      },
      {
        question: 'How do I change my password?',
        answer:
          'Click "Forgot password" on the login page to receive a password reset email. If you\'re already logged in, you can request a reset from your account settings.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'To delete your account, submit a support ticket under the "Account" category. Our team will process your request within 48 hours. Please note that this action is irreversible and will remove all your data.',
      },
      {
        question: 'Can I have both a trainer and client account?',
        answer:
          'At this time, each email address can only be associated with one role (trainer or client). You would need to use a different email address to create an account with a different role.',
      },
    ],
  },
  {
    category: 'For Trainers',
    icon: '🏋️',
    items: [
      {
        question: 'How do I go live and accept bookings?',
        answer:
          'Complete your trainer profile including bio, specialties, certifications, and profile photo. Then set your availability in the Availability section of your dashboard. Once your profile is complete and you\'re marked as live, clients can book you.',
      },
      {
        question: 'How do I set my availability?',
        answer:
          'In your trainer dashboard, go to the Availability tab. You can set recurring weekly hours or add specific one-off slots. Clients will only be able to book during the times you mark as available.',
      },
      {
        question: 'How does certification approval work?',
        answer:
          'Upload your certification documents in your trainer profile. Our team reviews submissions within 2–5 business days. You\'ll receive an email when your certification is approved or if additional information is needed.',
      },
      {
        question: 'How and when do I get paid?',
        answer:
          'Payouts are processed weekly to your connected Stripe account. You need a minimum balance of $50 to trigger an automatic payout. You can also request a manual payout from your dashboard at any time once the threshold is met.',
      },
    ],
  },
  {
    category: 'For Clients',
    icon: '🏃',
    items: [
      {
        question: 'How do I find the right trainer?',
        answer:
          'Use the search on the homepage to filter trainers by location, specialty, and price range. You can view each trainer\'s profile, read reviews from other clients, and see their availability before booking.',
      },
      {
        question: 'What is the Fitness Passport?',
        answer:
          'Your Fitness Passport is a personal record of your fitness journey on FitRush. It tracks your workout history, progress milestones, and achievements across all your sessions with different trainers.',
      },
      {
        question: 'How do I leave a review?',
        answer:
          'After a completed session, you\'ll receive a prompt to leave a review. Go to My Bookings, find the completed session, and click "Leave Review." Reviews help other clients find great trainers.',
      },
      {
        question: 'Can I book multiple trainers?',
        answer:
          'Absolutely. You can book sessions with as many different trainers as you like. Your booking history is stored under My Bookings and your progress is tracked in your Fitness Passport.',
      },
    ],
  },
];

const FAQAccordion: React.FC<{ item: FAQItem; isOpen: boolean; onToggle: () => void }> = ({
  item,
  isOpen,
  onToggle,
}) => (
  <div className="border-b border-ink/10">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-4 text-left group"
    >
      <span className="text-sm font-medium text-ink pr-4 group-hover:text-accent transition-colors">
        {item.question}
      </span>
      <ChevronDown
        size={16}
        className={`text-ink/40 flex-shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <p className="pb-4 text-sm text-ink/60 leading-relaxed">{item.answer}</p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filtered = search.trim()
    ? FAQ_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(search.toLowerCase()) ||
            item.answer.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((section) => section.items.length > 0)
    : FAQ_SECTIONS;

  return (
    <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-full mb-2">
            <LifeBuoy size={24} className="text-accent" />
          </div>
          <h1 className="text-3xl serif font-light italic text-ink">Help Center</h1>
          <p className="text-sm text-ink/50">
            Find answers to common questions or get in touch with our team.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30" />
          <input
            type="text"
            placeholder="Search for answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* FAQ Sections */}
        <div className="space-y-10">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-ink/40">
              No results for "{search}". Try a different search or submit a support ticket.
            </div>
          )}
          {filtered.map((section) => (
            <div key={section.category}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink/40 mb-4 flex items-center gap-2">
                <span>{section.icon}</span>
                {section.category}
              </h2>
              <div className="bg-white border border-ink/10 px-5">
                {section.items.map((item, idx) => {
                  const key = `${section.category}-${idx}`;
                  return (
                    <FAQAccordion
                      key={key}
                      item={item}
                      isOpen={!!openItems[key]}
                      onToggle={() => toggleItem(key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 border border-ink/10 bg-white p-8 text-center space-y-4">
          <MessageSquare size={28} className="mx-auto text-ink/30" />
          <h3 className="text-base font-medium text-ink">Still need help?</h3>
          <p className="text-sm text-ink/50">
            Our support team typically responds within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {user && (
              <button
                onClick={() => navigate('/help/tickets')}
                className="px-5 py-2.5 text-sm border border-ink/20 text-ink hover:bg-ink/5 transition-colors flex items-center justify-center gap-2"
              >
                <Ticket size={14} />
                My Tickets
              </button>
            )}
            <button
              onClick={() => (user ? navigate('/help/new-ticket') : navigate('/login'))}
              className="px-5 py-2.5 text-sm bg-accent text-white hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
            >
              <LifeBuoy size={14} />
              Submit a Support Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
