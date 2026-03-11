import React from 'react';
import { motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import SearchSection from './components/SearchSection';
import HowItWorks from './components/HowItWorks';
import TrustSafety from './components/TrustSafety';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper selection:bg-accent selection:text-white">
      <Navbar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <Hero />
        <main>
          <SearchSection />
          <HowItWorks />
          <TrustSafety />
        </main>
        <Footer />
      </motion.div>
    </div>
  );
};

export default App;