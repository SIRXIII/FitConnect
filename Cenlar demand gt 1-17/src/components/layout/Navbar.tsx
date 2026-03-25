import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Bell, MessageSquare, MapPin, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const { user, profile, signOut } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllRead, refetch: refetchNotifications } = useNotifications();
  const { unreadCount: unreadMessages } = useUnreadMessages();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = () => {
      setShowUserMenu(false);
      setShowNotifs(false);
    };
    if (showUserMenu || showNotifs) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showUserMenu, showNotifs]);

  const handleSignOut = async () => {
    await signOut(); // waits for localStorage to be cleared before navigating
    navigate('/');
  };

  const dashboardPath =
    profile?.role === 'trainer' ? '/trainer/dashboard' :
    profile?.role === 'admin' ? '/admin' :
    '/client/dashboard';

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
          <Link to="/" className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="FitRush" className="hidden sm:block h-8 w-8 object-contain" />
            <span className="text-2xl font-light tracking-[0.2em] uppercase serif cursor-pointer">
              FitRush
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-12">
            <a href="/#search" className="text-[13px] uppercase tracking-[0.1em] font-semibold hover:text-accent transition-colors">Trainers</a>
            <a href="/#how-it-works" className="text-[13px] uppercase tracking-[0.1em] font-semibold hover:text-accent transition-colors">Experience</a>
            <a href="/#safety" className="text-[13px] uppercase tracking-[0.1em] font-semibold hover:text-accent transition-colors">Safety</a>
            <Link to="/faq" className="text-[13px] uppercase tracking-[0.1em] font-semibold hover:text-accent transition-colors">FAQ</Link>

            {user ? (
              <>
                {/* Messages icon */}
                <button
                  onClick={() => navigate('/messages')}
                  className="relative p-1.5 hover:text-accent transition-colors"
                >
                  <MessageSquare size={18} strokeWidth={1.5} />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </button>

                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotifs(!showNotifs);
                      setShowUserMenu(false);
                    }}
                    className="relative p-1.5 hover:text-accent transition-colors"
                  >
                    <Bell size={18} strokeWidth={1.5} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifs && (
                    <div className="absolute right-0 top-full mt-3 w-80 bg-paper border border-ink/10 shadow-lg max-h-96 overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-ink/5 flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-ink/40">Notifications</p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); refetchNotifications(); }}
                            className="text-ink/30 hover:text-accent transition-colors"
                            title="Refresh notifications"
                          >
                            <RefreshCw size={11} strokeWidth={1.5} />
                          </button>
                          {unreadCount > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                              className="text-[9px] uppercase tracking-wider text-accent hover:text-accent/70 transition-colors"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-xs text-ink/30">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!notif.read) markAsRead(notif.id);
                                if (notif.link) navigate(notif.link);
                                setShowNotifs(false);
                              }}
                              className={`w-full text-left px-4 py-3 border-b border-ink/5 hover:bg-ink/3 transition-colors ${
                                !notif.read ? 'bg-accent/3' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {!notif.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                                )}
                                <div className={!notif.read ? '' : 'pl-3.5'}>
                                  <div className="flex items-center gap-1">
                                    {(notif as any).type === 'trainer_live_nearby' && (
                                      <MapPin size={12} className="text-accent shrink-0" />
                                    )}
                                    <p className="text-xs font-medium text-ink">{notif.title}</p>
                                  </div>
                                  <p className="text-[10px] text-ink/40 mt-0.5">{notif.message}</p>
                                  <p className="text-[9px] text-ink/20 mt-1">
                                    {new Date(notif.created_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User avatar */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                      setShowNotifs(false);
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
                      {profile?.role === 'trainer' && (
                        <button
                          onClick={() => navigate('/trainer/bookings')}
                          className="w-full px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-ink/60 hover:text-ink hover:bg-ink/3 flex items-center gap-3 transition-colors"
                        >
                          <LayoutDashboard size={14} strokeWidth={1.5} />
                          Bookings
                        </button>
                      )}
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
              </>
            ) : (
              <Link
                to="/login"
                className="border border-ink/20 px-8 py-2.5 text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all duration-300"
              >
                Sign In
              </Link>
            )}
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
        <div className="md:hidden bg-paper fixed inset-0 z-[60] flex flex-col justify-center items-center space-y-8">
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-8 right-6 p-2 text-ink"
          >
            <X size={20} strokeWidth={1.5} />
          </button>

          <a href="/#search" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Trainers</a>
          <a href="/#how-it-works" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Experience</a>
          <a href="/#safety" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">Safety</a>
          <Link to="/faq" onClick={() => setIsOpen(false)} className="text-2xl serif font-light tracking-widest hover:text-accent">FAQ</Link>

          {user ? (
            <>
              <button
                onClick={() => { navigate('/messages'); setIsOpen(false); }}
                className="text-2xl serif font-light tracking-widest hover:text-accent flex items-center gap-3"
              >
                Messages
                {unreadMessages > 0 && (
                  <span className="w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
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
