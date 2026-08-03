import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full top-0 z-50 transition-all duration-500 ${scrolled ? 'bg-paper/80 backdrop-blur-md py-4 border-b border-ink/5' : 'bg-transparent py-8'}`}>
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl font-light tracking-[0.2em] uppercase serif cursor-pointer">
              FitConnect
            </span>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-12">
              <a href="#search" className="text-[11px] uppercase tracking-[0.2em] font-medium hover:text-accent transition-colors">Trainers</a>
              <a href="#how-it-works" className="text-[11px] uppercase tracking-[0.2em] font-medium hover:text-accent transition-colors">Experience</a>
              <a href="#safety" className="text-[11px] uppercase tracking-[0.2em] font-medium hover:text-accent transition-colors">Safety</a>
              <button className="border border-ink/20 px-8 py-2.5 text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all duration-300">
                Sign In
              </button>
            </div>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-ink p-2"
            >
              {isOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-paper h-screen absolute w-full top-0 left-0 z-[-1] flex flex-col justify-center items-center space-y-8">
          <a href="#search" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Trainers</a>
          <a href="#how-it-works" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Experience</a>
          <a href="#safety" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Safety</a>
          <button className="border border-ink/20 px-12 py-4 text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all">
            Sign In
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;