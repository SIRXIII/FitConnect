import { motion } from 'framer-motion';
import Hero from '@/components/landing/Hero';
import SearchSection from '@/components/search/SearchSection';
import BestDeals from '@/components/landing/BestDeals';
import FeaturedTrainers from '@/components/landing/FeaturedTrainers';
import HowItWorks from '@/components/landing/HowItWorks';
import TrainerTestimonials from '@/components/landing/TrainerTestimonials';
import TrustSafety from '@/components/landing/TrustSafety';
import ReferralLeaderboard from '@/components/landing/ReferralLeaderboard';
import Partners from '@/components/landing/Partners';

const Landing: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      <Hero />
      <main>
        <SearchSection />
        <FeaturedTrainers />
        <BestDeals />
        <HowItWorks />
        <TrainerTestimonials />
        <TrustSafety />
        <ReferralLeaderboard />
        <Partners />
      </main>
    </motion.div>
  );
};

export default Landing;
