import { motion } from 'framer-motion';
import Hero from '@/components/landing/Hero';
import SearchSection from '@/components/search/SearchSection';
import HowItWorks from '@/components/landing/HowItWorks';
import TrustSafety from '@/components/landing/TrustSafety';

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
        <HowItWorks />
        <TrustSafety />
      </main>
    </motion.div>
  );
};

export default Landing;
