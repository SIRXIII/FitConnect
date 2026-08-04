import { Instagram, Twitter, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isNativeiOS } from '@/lib/platform';

const Footer: React.FC = () => {
  return (
    <footer className="bg-ink text-paper pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-24">
          <div className="md:col-span-6 space-y-10">
            <div className="flex items-center gap-3">
              <img src="/assets/logo.png" alt="FitRush" className="h-10 w-10 object-contain rounded-lg" />
              <h3 className="text-3xl font-light tracking-[0.3em] uppercase serif">
                FitRush
              </h3>
            </div>
            <p className="text-paper/40 text-sm font-light leading-relaxed max-w-sm">
              Refining the standard of personal training. Connecting discerning individuals with certified mastery during exclusive downtime.
            </p>
            <div className="flex space-x-8">
              <a href="#" target="_blank" rel="noopener noreferrer" title="Coming soon" className="text-paper/40 hover:text-accent transition-colors" aria-label="Instagram">
                <Instagram size={18} strokeWidth={1.5} />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" title="Coming soon" className="text-paper/40 hover:text-accent transition-colors" aria-label="Twitter">
                <Twitter size={18} strokeWidth={1.5} />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" title="Coming soon" className="text-paper/40 hover:text-accent transition-colors" aria-label="LinkedIn">
                <Linkedin size={18} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-8">
            <h4 className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent">The Collective</h4>
            <ul className="space-y-4 text-xs tracking-widest font-light text-paper/60">
              <li><Link to="/#search" className="hover:text-paper transition-colors">Find a Professional</Link></li>
              <li><Link to="/#how-it-works" className="hover:text-paper transition-colors">The Experience</Link></li>
              <li><Link to="/#search" className="hover:text-paper transition-colors">Browse Trainers</Link></li>
              {!isNativeiOS() && <li><Link to="/pricing" className="hover:text-paper transition-colors">Pricing</Link></li>}
              <li><Link to="/faq" className="hover:text-paper transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-8">
            <h4 className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent">Partnership</h4>
            <ul className="space-y-4 text-xs tracking-widest font-light text-paper/60">
              <li><Link to="/login?mode=signup&role=trainer" className="hover:text-paper transition-colors">Join the Collective</Link></li>
              <li><Link to="/#safety" className="hover:text-paper transition-colors">Standards & Safety</Link></li>
              <li><Link to="/login?mode=signup&role=trainer" className="hover:text-paper transition-colors">Partner Portal</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-paper/5 flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
          <p className="text-paper/20 text-[10px] uppercase tracking-[0.2em]">&copy; 2026 FitRush. All rights reserved.</p>
          <div className="flex space-x-10 text-[10px] uppercase tracking-[0.2em] text-paper/20">
            <Link to="/privacy" className="hover:text-paper/60 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-paper/60 transition-colors">Terms</Link>
            <span className="cursor-default">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
