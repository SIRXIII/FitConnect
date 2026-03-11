import React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-ink text-paper pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-24">
          <div className="md:col-span-6 space-y-10">
            <h3 className="text-3xl font-light tracking-[0.3em] uppercase serif">
              FitConnect
            </h3>
            <p className="text-paper/40 text-sm font-light leading-relaxed max-w-sm">
              Refining the standard of personal training. Connecting discerning individuals with certified mastery during exclusive downtime.
            </p>
            <div className="flex space-x-8">
              <a href="#" className="text-paper/40 hover:text-accent transition-colors">
                <Instagram size={18} strokeWidth={1.5} />
              </a>
              <a href="#" className="text-paper/40 hover:text-accent transition-colors">
                <Twitter size={18} strokeWidth={1.5} />
              </a>
              <a href="#" className="text-paper/40 hover:text-accent transition-colors">
                <Linkedin size={18} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-8">
            <h4 className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent">The Collective</h4>
            <ul className="space-y-4 text-xs tracking-widest font-light text-paper/60">
              <li><a href="#" className="hover:text-paper transition-colors">Find a Professional</a></li>
              <li><a href="#" className="hover:text-paper transition-colors">The Experience</a></li>
              <li><a href="#" className="hover:text-paper transition-colors">Success Stories</a></li>
              <li><a href="#" className="hover:text-paper transition-colors">Investment Guide</a></li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-8">
            <h4 className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent">Partnership</h4>
            <ul className="space-y-4 text-xs tracking-widest font-light text-paper/60">
              <li><a href="#" className="hover:text-paper transition-colors">Join the Collective</a></li>
              <li><a href="#" className="hover:text-paper transition-colors">Professional Standards</a></li>
              <li><a href="#" className="hover:text-paper transition-colors">Insurance & Safety</a></li>
              <li><a href="#" className="hover:text-paper transition-colors">Partner Portal</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-paper/5 flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
          <p className="text-paper/20 text-[10px] uppercase tracking-[0.2em]">© 2026 FitConnect. All rights reserved.</p>
          <div className="flex space-x-10 text-[10px] uppercase tracking-[0.2em] text-paper/20">
            <a href="#" className="hover:text-paper transition-colors">Privacy</a>
            <a href="#" className="hover:text-paper transition-colors">Terms</a>
            <a href="#" className="hover:text-paper transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;