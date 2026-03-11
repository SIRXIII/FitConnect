import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showUserMenu]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const dashboardPath = profile?.role === 'trainer' ? '/trainer/dashboard' : '/client/dashboard';

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <nav className={`fixed w-full top-0 z-50 transition-all duration-500 ${scrolled ? 'bg-paper/80 backdrop-blur-md py-4 border-b border-ink/5' : 'bg-transparent py-8'}`}>
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-light tracking-[0.2em] uppercase serif cursor-pointer">
              FitConnect
            </span>
          </Link>

          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-12">
              <a href="/#search" className="text-[11px] uppercase tracking-[0.2em] font-medium hover:text-accent transition-colors">Trainers</a>
              <a href="/#how-it-works" className="text-[11px] uppercase tracking-[0.2em] font-medium hover:text-accent transition-colors">Experience</a>
              <a href="/#safety" className="text-[11px] uppercase tracking-[0.2em] font-medium hover:text-accent transition-colors">Safety</a>

              {user ? (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                    }}
                    className="flex items-center gap-3 group"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || ''}
                        className="w-8 h-8 rounded-full object-cover border border-ink/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-[10px] font-medium text-ink/60">
                        {initials}
                      </div>
                    )}
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-3 w-52 bg-paper border border-ink/10 shadow-lg py-2">
                      <div className="px-4 py-3 border-b border-ink/5">
                        <p className="text-xs font-medium text-ink truncate">{profile?.full_name}</p>
                        <p className="text-[10px] text-ink/40 uppercase tracking-wider mt-1">
                          {profile?.role || 'Member'}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(dashboardPath)}
                        className="w-full px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-ink/60 hover:text-ink hover:bg-ink/3 flex items-center gap-3 transition-colors"
                      >
                        <LayoutDashboard size={14} strokeWidth={1.5} />
                        Dashboard
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-ink/60 hover:text-ink hover:bg-ink/3 flex items-center gap-3 transition-colors"
                      >
                        <LogOut size={14} strokeWidth={1.5} />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="border border-ink/20 px-8 py-2.5 text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all duration-300"
                >
                  Sign In
                </Link>
              )}
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
          <a href="/#search" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Trainers</a>
          <a href="/#how-it-works" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Experience</a>
          <a href="/#safety" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Safety</a>

          {user ? (
            <>
              <button
                onClick={() => { navigate(dashboardPath); setIsOpen(false); }}
                className="text-2xl serif font-light tracking-widest hover:text-accent"
              >
                Dashboard
              </button>
              <button
                onClick={() => { handleSignOut(); setIsOpen(false); }}
                className="border border-ink/20 px-12 py-4 text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="border border-ink/20 px-12 py-4 text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
