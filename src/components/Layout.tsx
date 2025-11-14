import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Home,
  Scissors,
  User,
  ChevronDown,
  Users,
  BarChart,
  Settings,
  Search,
  LogOut,
  Clock,
  CalendarOff,
  Star,
  Menu,
  X,
  Briefcase,
  Mail
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { NotificationBadge } from './NotificationBadge';
import { useEmailNotifications } from '../hooks/useEmailNotifications';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const { profile, signOut } = useAuthStore();
  const { unreadCount } = useEmailNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showManagementMenu, setShowManagementMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const managementMenuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (managementMenuRef.current && !managementMenuRef.current.contains(event.target as Node)) {
        setShowManagementMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const mobileMenuLinkClass = (isActive: boolean) =>
    `flex items-center px-5 py-4 min-h-[56px] text-base font-semibold transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation ${
      isActive ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-18 md:h-20">
            <div className="flex items-center flex-1">
              <Link to="/" className="flex items-center space-x-2 sm:space-x-3">
                <img
                  src="/icons/belleza-logo.svg"
                  alt="Belleza"
                  className="h-7 sm:h-9 md:h-11 w-auto"
                />
              </Link>

              <div className="hidden lg:ml-8 lg:flex lg:items-center lg:space-x-1 flex-1">
                {profile?.role === 'super_admin' ? (
                  <>
                    <Link
                      to="/super-admin/dashboard"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/super-admin/dashboard')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      to="/super-admin/emails"
                      className={`relative flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/super-admin/emails')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      <span>Mensagens</span>
                      {unreadCount > 0 && (
                        <span className="ml-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        location.pathname === '/'
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      <span>{t('navigation.home')}</span>
                    </Link>
                  </>
                ) : profile?.role === 'admin' ? (
                  <>
                    <Link
                      to="/admin/dashboard"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/admin/dashboard')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      <span>Dashboard Admin</span>
                    </Link>
                    <Link
                      to="/"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        location.pathname === '/'
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      <span>{t('navigation.home')}</span>
                    </Link>
                  </>
                ) : profile?.role === 'professional' ? (
                  <>
                    <Link
                      to="/professional/dashboard"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/professional/dashboard')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      <span>{t('navigation.dashboard')}</span>
                    </Link>
                    <Link
                      to="/professional/calendar"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/professional/calendar')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{t('navigation.calendar')}</span>
                    </Link>
                    <Link
                      to="/professional/services"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/professional/services')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Scissors className="h-4 w-4 mr-2" />
                      <span>{t('navigation.services')}</span>
                    </Link>
                    <Link
                      to="/professional/clients"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActiveRoute('/professional/clients')
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      <span>{t('navigation.clients')}</span>
                    </Link>

                    <div className="relative" ref={managementMenuRef}>
                      <button
                        onClick={() => setShowManagementMenu(!showManagementMenu)}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActiveRoute('/professional/availability') ||
                          isActiveRoute('/professional/blocked-dates') ||
                          isActiveRoute('/professional/reviews')
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                        }`}
                      >
                        <Briefcase className="h-4 w-4 mr-2" />
                        <span>Gestão</span>
                        <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showManagementMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showManagementMenu && (
                        <div className="absolute left-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-slate-200 ring-opacity-5 divide-y divide-slate-100">
                          <div className="py-1">
                            <Link
                              to="/professional/availability"
                              className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                                isActiveRoute('/professional/availability')
                                  ? 'text-blue-600 bg-blue-50'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              onClick={() => setShowManagementMenu(false)}
                            >
                              <Clock className="h-4 w-4 mr-3" />
                              <span>{t('navigation.availability')}</span>
                            </Link>
                            <Link
                              to="/professional/blocked-dates"
                              className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                                isActiveRoute('/professional/blocked-dates')
                                  ? 'text-blue-600 bg-blue-50'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              onClick={() => setShowManagementMenu(false)}
                            >
                              <CalendarOff className="h-4 w-4 mr-3" />
                              <span>{t('navigation.blockedDates')}</span>
                            </Link>
                            <Link
                              to="/professional/blocked-time-slots"
                              className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                                isActiveRoute('/professional/blocked-time-slots')
                                  ? 'text-blue-600 bg-blue-50'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              onClick={() => setShowManagementMenu(false)}
                            >
                              <Clock className="h-4 w-4 mr-3 text-red-600" />
                              <span>Bloqueio de Horários</span>
                            </Link>
                            <Link
                              to="/professional/reviews"
                              className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                                isActiveRoute('/professional/reviews')
                                  ? 'text-blue-600 bg-blue-50'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              onClick={() => setShowManagementMenu(false)}
                            >
                              <Star className="h-4 w-4 mr-3" />
                              <span>{t('navigation.reviews')}</span>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      to="/"
                      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        location.pathname === '/'
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      <span>{t('navigation.home')}</span>
                    </Link>
                    {profile && profile.role === 'client' && (
                      <Link
                        to="/bookings"
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActiveRoute('/bookings')
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>Minhas Reservas</span>
                      </Link>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden ml-2 p-3 min-h-[56px] min-w-[56px] rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all duration-200 active:scale-95 touch-manipulation flex items-center justify-center shadow-sm"
                aria-label="Toggle menu"
              >
                {showMobileMenu ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>

            <div className="hidden lg:flex items-center ml-2 sm:ml-4 space-x-2">
              {profile && profile.role === 'professional' && <NotificationBadge />}
              {profile ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all"
                  >
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || ''}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-200"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                        {profile.full_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{profile.full_name || t(`roles.${profile.role}`)}</span>
                      <span className="text-xs text-slate-500">{t(`roles.${profile.role}`)}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-slate-200 ring-opacity-5 divide-y divide-slate-100">
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t(`roles.${profile.role}`)}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings className="h-4 w-4 mr-3" />
                          {t('navigation.settings')}
                        </Link>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4 mr-3" />
                          {t('auth.signOut')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/auth/login"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow"
                >
                  {t('auth.signIn')}
                </Link>
              )}
            </div>
          </div>

          {showMobileMenu && (
            <div className="lg:hidden border-t border-slate-200 py-4 space-y-2 animate-slide-up bg-white shadow-lg max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin">
              {profile?.role === 'super_admin' ? (
                <>
                  <Link
                    to="/super-admin/dashboard"
                    className={`flex items-center px-5 py-4 min-h-[56px] text-base font-semibold transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation ${
                      isActiveRoute('/super-admin/dashboard')
                        ? 'text-blue-600 bg-blue-50 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Home className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    to="/super-admin/emails"
                    className={`relative flex items-center px-5 py-4 min-h-[56px] text-base font-semibold transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation ${
                      isActiveRoute('/super-admin/emails')
                        ? 'text-blue-600 bg-blue-50 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Mail className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Mensagens</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/"
                    className={`flex items-center px-5 py-4 min-h-[56px] text-base font-semibold transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation ${
                      location.pathname === '/'
                        ? 'text-blue-600 bg-blue-50 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Search className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Ver Plataforma</span>
                  </Link>
                </>
              ) : profile?.role === 'admin' ? (
                <>
                  <Link
                    to="/admin/dashboard"
                    className={`flex items-center px-5 py-4 min-h-[56px] text-base font-semibold transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation ${
                      isActiveRoute('/admin/dashboard')
                        ? 'text-blue-600 bg-blue-50 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Home className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Dashboard Admin</span>
                  </Link>
                  <Link
                    to="/"
                    className={`flex items-center px-5 py-4 min-h-[56px] text-base font-semibold transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation ${
                      location.pathname === '/'
                        ? 'text-blue-600 bg-blue-50 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Search className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Ver Plataforma</span>
                  </Link>
                </>
              ) : profile?.role === 'professional' ? (
                <>
                  <Link
                    to="/professional/dashboard"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/dashboard'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Home className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>{t('navigation.dashboard')}</span>
                  </Link>
                  <Link
                    to="/professional/calendar"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/calendar'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Calendar className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Calendário</span>
                  </Link>
                  <Link
                    to="/professional/services"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/services'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Scissors className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>{t('navigation.services')}</span>
                  </Link>
                  <Link
                    to="/professional/clients"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/clients'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Users className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>{t('navigation.clients')}</span>
                  </Link>
                  <div className="px-5 py-3 text-sm font-bold text-slate-500 uppercase tracking-wider">Gestão</div>
                  <Link
                    to="/professional/availability"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/availability'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Clock className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Disponibilidade</span>
                  </Link>
                  <Link
                    to="/professional/blocked-dates"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/blocked-dates'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <CalendarOff className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Datas Bloqueadas</span>
                  </Link>
                  <Link
                    to="/professional/blocked-time-slots"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/blocked-time-slots'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Clock className="h-6 w-6 mr-3 flex-shrink-0 text-red-600" />
                    <span>Bloqueio de Horários</span>
                  </Link>
                  <Link
                    to="/professional/reviews"
                    className={mobileMenuLinkClass(isActiveRoute('/professional/reviews'))}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Star className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Avaliações</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/"
                    className={mobileMenuLinkClass(location.pathname === '/')}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Home className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>Início</span>
                  </Link>
                  {profile && profile.role === 'client' && (
                    <Link
                      to="/bookings"
                      className={mobileMenuLinkClass(isActiveRoute('/bookings'))}
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <Calendar className="h-6 w-6 mr-3 flex-shrink-0" />
                      <span>Minhas Reservas</span>
                    </Link>
                  )}
                </>
              )}

              {profile && (
                <>
                  <div className="border-t border-slate-200 my-2"></div>
                  <Link
                    to="/profile"
                    className="flex items-center px-5 py-4 min-h-[56px] text-base font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <Settings className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>{t('navigation.settings')}</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setShowMobileMenu(false);
                    }}
                    className="flex items-center w-full text-left px-5 py-4 min-h-[56px] text-base font-semibold text-red-600 hover:bg-red-50 transition-all duration-200 rounded-xl mx-2 active:scale-98 touch-manipulation"
                  >
                    <LogOut className="h-6 w-6 mr-3 flex-shrink-0" />
                    <span>{t('auth.signOut')}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-2 sm:px-6 md:px-8 lg:px-10 py-3 sm:py-7 md:py-9">
        {children}
      </main>
    </div>
  );
}