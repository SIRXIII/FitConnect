import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Hero from '@/components/landing/Hero';
import SearchSection from '@/components/search/SearchSection';
import BestDeals from '@/components/landing/BestDeals';
import FeaturedTrainers from '@/components/landing/FeaturedTrainers';
import HowItWorks from '@/components/landing/HowItWorks';
import TrustSafety from '@/components/landing/TrustSafety';
import ReferralLeaderboard from '@/components/landing/ReferralLeaderboard';
import { captureReferralCode } from '@/lib/referral';

const Landing: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      captureReferralCode(refCode);
    }
  }, []);

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
        <TrustSafety />
        <ReferralLeaderboard />
      </main>
    </motion.div>
  );
};

export default Landing;
