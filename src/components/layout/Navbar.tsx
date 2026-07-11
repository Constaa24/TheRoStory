import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { User, Menu, X, Search, Sun, Moon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Article, Category, searchArticles, fetchCategories, getLocalized } from "@/lib/supabase";
import { articleCoverUrl } from "@/lib/article-utils";

export const Navbar: React.FC = () => {
  const { user, login, logout, isAdmin, isWriter, signInWithGoogle } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const mobileMenuRef = React.useRef<HTMLDivElement>(null);
  const profileRootRef = React.useRef<HTMLDivElement>(null);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  useFocusTrap(mobileMenuRef, isMenuOpen);
  // Trap focus in the profile dropdown while open and restore it to the
  // trigger on close — keyboard users could previously tab straight past
  // an open menu into the page underneath.
  useFocusTrap(profileDropdownRef, profileOpen);

  React.useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  React.useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profileOpen]);

  React.useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileRootRef.current && !profileRootRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [profileOpen]);

  const showDashboard = isAdmin || isWriter;
  const isDark = theme !== 'light';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const navLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.map"), path: "/map" },
    { name: t("nav.categories"), path: "/categories" },
    { name: t("nav.support"), path: "/support" },
    { name: t("nav.myStory"), path: "/my-story" },
    { name: t("nav.contactUs"), path: "/contact-us" },
  ];

  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const tier = language === 'en' ? 'Wanderer · Member' : 'Călător · Membru';

  return (
    <header className="ed-nav">
      <div className="ed-container flex items-center justify-between gap-6" style={{ paddingTop: 18, paddingBottom: 18, minHeight: 76 }}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <picture>
            <source type="image/webp" srcSet="/logo.webp" />
            <img src="/logo.png" alt="The RoStory" width={42} height={42} className="h-[42px] w-[42px] object-contain" />
          </picture>
          <span
            className="font-display italic font-semibold text-[23px] whitespace-nowrap hidden sm:inline"
            style={{
              background: 'var(--logo-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              padding: '0.1em 0',
            }}
          >
            The RoStory
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(link => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={active ? 'page' : undefined}
                className="px-4 py-2.5 font-display italic font-medium text-[18px] transition-colors"
                style={{
                  color: active ? 'var(--gold)' : 'var(--text)',
                  borderBottom: active ? '1px solid var(--gold)' : '1px solid transparent',
                }}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSearchOpen(s => !s)}
            aria-label={language === 'en' ? 'Search' : 'Caută'}
            aria-expanded={searchOpen}
            className="grid w-10 h-10 rounded-full place-items-center transition-colors hover:text-gold"
            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)' }}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Lang toggle */}
          <div className="hidden md:flex items-center" style={{ border: '1px solid var(--line)', borderRadius: 999, padding: 4 }}>
            {(['en', 'ro'] as const).map(L => {
              const active = language === L;
              return (
                <button
                  key={L}
                  onClick={() => setLanguage(L)}
                  className="px-3 py-1.5 font-ui font-semibold text-[11px] tracking-[0.18em] rounded-full cursor-pointer transition-colors"
                  style={{
                    background: active ? 'var(--gold)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--text-dim)',
                    border: 0,
                  }}
                >
                  {L.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? (language === 'en' ? 'Switch to light mode' : 'Mod luminos') : (language === 'en' ? 'Switch to dark mode' : 'Mod întunecat')}
            className="hidden md:grid w-10 h-10 rounded-full place-items-center transition-colors hover:text-gold"
            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)' }}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Profile / Account */}
          <div ref={profileRootRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setProfileOpen(o => !o); }}
              aria-label={language === 'en' ? 'Account' : 'Cont'}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              className="grid place-items-center rounded-full transition-colors hover:text-gold"
              style={{
                width: 40,
                height: 40,
                border: '1px solid var(--line)',
                background: user ? 'rgba(201,169,110,0.06)' : 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {user?.avatarUrl ? (
                <Avatar className="h-full w-full">
                  <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email || ''} />
                  <AvatarFallback
                    className="text-xs bg-transparent font-display italic font-semibold"
                    style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)', color: 'var(--ink)' }}
                  >{initial}</AvatarFallback>
                </Avatar>
              ) : user ? (
                <span
                  className="grid place-items-center w-full h-full font-display italic font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)', color: 'var(--ink)' }}
                >{initial}</span>
              ) : (
                <User className="w-[15px] h-[15px]" />
              )}
            </button>

            {profileOpen && (
              <div
                ref={profileDropdownRef}
                className="absolute right-0 z-[60] screen-anim"
                style={{
                  top: 'calc(100% + 12px)',
                  width: 320,
                  background: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  boxShadow: 'var(--shadow-dropdown)',
                }}
              >
                {user ? (
                  <>
                    <div className="px-6 pt-6 pb-5" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <div className="flex items-center gap-4">
                        <span
                          className="grid place-items-center overflow-hidden"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)',
                            color: 'var(--ink)',
                            fontFamily: 'var(--display)',
                            fontStyle: 'italic',
                            fontWeight: 600,
                            fontSize: 18,
                          }}
                        >
                          {user.avatarUrl ? (
                            <Avatar className="h-11 w-11">
                              <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email || ''} />
                              <AvatarFallback className="bg-transparent text-[color:var(--ink)] font-display italic font-semibold">{initial}</AvatarFallback>
                            </Avatar>
                          ) : initial}
                        </span>
                        <div className="min-w-0">
                          <div className="font-display italic text-[19px] truncate" style={{ color: 'var(--parchment)' }}>
                            {user.displayName || user.email}
                          </div>
                          <div className="font-ui text-[10px] tracking-[0.15em] uppercase mt-0.5" style={{ color: 'var(--gold)' }}>
                            {tier}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="py-2">
                      <ProfileRow num={1} to="/profile" label={t('nav.profile')} sub={language === 'en' ? 'Account & settings' : 'Cont și setări'} onNav={() => setProfileOpen(false)} />
                      <ProfileRow num={2} to="/profile?tab=favorites" label={t('nav.favorites')} sub={language === 'en' ? 'Saved stories' : 'Povești salvate'} onNav={() => setProfileOpen(false)} />
                      {showDashboard && (
                        <ProfileRow num={3} to="/admin" label={isAdmin ? t('nav.admin') : t('nav.dashboard')} sub={language === 'en' ? 'Editorial dashboard' : 'Panou editorial'} onNav={() => setProfileOpen(false)} />
                      )}
                    </div>
                    <div style={{ borderTop: '1px solid var(--line-soft)' }}>
                      <button
                        onClick={() => { logout(); setProfileOpen(false); }}
                        className="w-full text-left px-6 py-3.5 font-ui text-[11px] tracking-[0.18em] uppercase cursor-pointer transition-colors"
                        style={{ background: 'transparent', border: 0, color: 'var(--oxblood-2)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {t('nav.logout')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-6">
                    <div className="eyebrow mb-2">{language === 'en' ? 'Welcome' : 'Bine ai venit'}</div>
                    <h4 className="font-display italic font-medium text-[26px] leading-tight m-0 mb-4" style={{ color: 'var(--parchment)' }}>
                      {language === 'en' ? 'Sign in to The RoStory.' : 'Intră în The RoStory.'}
                    </h4>
                    <p className="text-ink-dim text-[13px] leading-relaxed m-0 mb-5">
                      {language === 'en'
                        ? 'Save stories, leave notes, and follow the field journals of our writers.'
                        : 'Salvează povești, lasă notițe și urmărește jurnalele de teren ale scriitorilor.'}
                    </p>
                    <button
                      onClick={() => { setProfileOpen(false); login(); }}
                      className="btn-ed w-full justify-center"
                      style={{ padding: '12px 20px' }}
                    >
                      {language === 'en' ? 'Continue with email' : 'Continuă cu email'}
                    </button>
                    <div className="flex items-center gap-2 my-4 font-ui text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--text-mute)' }}>
                      <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                      <span>{language === 'en' ? 'or' : 'sau'}</span>
                      <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                    </div>
                    <button
                      onClick={() => {
                        // Actually start the Google OAuth flow — this used to
                        // just navigate to /auth, despite the label.
                        setProfileOpen(false);
                        void signInWithGoogle();
                      }}
                      className="w-full flex items-center justify-center gap-2.5 py-3 cursor-pointer transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', borderRadius: 4, fontFamily: 'var(--ui)', fontSize: 12, letterSpacing: '0.1em' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="w-4 h-4 grid place-items-center font-bold">G</span>
                      {language === 'en' ? 'Continue with Google' : 'Continuă cu Google'}
                    </button>
                    <div className="text-center mt-4 font-ui text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--text-mute)' }}>
                      {language === 'en' ? 'New here? ' : 'Nou aici? '}
                      <Link to="/auth?mode=signup" onClick={() => setProfileOpen(false)} className="text-gold">
                        {language === 'en' ? 'Create an account' : 'Creează cont'}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsMenuOpen(o => !o)}
            aria-label={isMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={isMenuOpen}
            className="lg:hidden grid w-10 h-10 rounded-full place-items-center transition-colors hover:text-gold"
            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)' }}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <NavSearchOverlay onClose={() => setSearchOpen(false)} language={language} />
      )}

      {/* Mobile menu */}
      {isMenuOpen && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.openMenu')}
          className="lg:hidden border-t screen-anim"
          style={{ borderColor: 'var(--line-soft)', background: 'var(--overlay-nav)' }}
        >
          <div className="ed-container flex flex-col gap-2" style={{ paddingTop: 96, paddingBottom: 96 }}>
            {navLinks.map(link => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'px-4 py-3 font-display italic text-[22px] transition-colors',
                  )}
                  style={{
                    color: active ? 'var(--gold)' : 'var(--text)',
                    borderBottom: '1px solid var(--line-soft)',
                  }}
                >
                  {link.name}
                </Link>
              );
            })}
            <div className="flex items-center justify-center gap-6 pt-10 mt-2">
              <div className="flex items-center" style={{ border: '1px solid var(--line)', borderRadius: 999, padding: 4 }}>
                {(['en', 'ro'] as const).map(L => (
                  <button
                    key={L}
                    onClick={() => setLanguage(L)}
                    className="px-3 py-1.5 font-ui font-semibold text-[11px] tracking-[0.18em] rounded-full cursor-pointer"
                    style={{
                      background: language === L ? 'var(--gold)' : 'transparent',
                      color: language === L ? 'var(--ink)' : 'var(--text-dim)',
                      border: 0,
                    }}
                  >
                    {L.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="grid w-10 h-10 rounded-full place-items-center"
                style={{ border: '1px solid var(--line)', color: 'var(--text)' }}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

const NavSearchOverlay: React.FC<{ onClose: () => void; language: 'en' | 'ro' }> = ({ onClose, language }) => {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Article[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<number | undefined>(undefined);
  const reqIdRef = React.useRef(0);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      window.clearTimeout(debounceRef.current);
      return;
    }
    setIsSearching(true);
    window.clearTimeout(debounceRef.current);
    const reqId = ++reqIdRef.current;
    debounceRef.current = window.setTimeout(async () => {
      try {
        const articles = await searchArticles(q);
        if (reqIdRef.current !== reqId) return;
        setResults(articles);
        setFetchError(false);
      } catch {
        if (reqIdRef.current !== reqId) return;
        setFetchError(true);
        setResults([]);
      } finally {
        if (reqIdRef.current === reqId) setIsSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (article: Article) => {
    onClose();
    navigate(`/article/${article.id}`);
  };

  const showResults = query.trim().length > 0;

  return (
    <div className="border-t" style={{ borderColor: 'var(--line-soft)', background: 'var(--overlay-nav)' }}>
      <div className="ed-container py-6">
        <div className="max-w-[720px] mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 hidden sm:inline">
              {language === 'en' ? 'Search the archive' : 'Caută în arhivă'}
            </span>
            <div className="relative flex-1 min-w-0">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'var(--text-mute)' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={language === 'en' ? "Try 'Voroneț', 'salt mines', 'Mărțișor'…" : "Încearcă 'Voroneț', 'saline', 'Mărțișor'…"}
                className="w-full"
                style={{
                  background: 'transparent',
                  border: 0,
                  borderBottom: '1px solid var(--gold)',
                  borderRadius: 0,
                  padding: '10px 36px 10px 36px',
                  fontSize: 22,
                  fontFamily: 'var(--display)',
                  fontStyle: 'italic',
                  color: 'var(--parchment)',
                }}
              />
              {isSearching && (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin pointer-events-none"
                  style={{ color: 'var(--gold)' }}
                />
              )}
            </div>
            <button
              onClick={onClose}
              className="pill cursor-pointer shrink-0"
              aria-label={language === 'en' ? 'Close search' : 'Închide căutarea'}
            >
              Esc
            </button>
          </div>

          {showResults && (
            <div
              className="overflow-hidden"
              style={{ border: '1px solid var(--line)', background: 'var(--ink-2)' }}
            >
              {isSearching && results.length === 0 ? (
                <div className="px-4 py-5 flex items-center justify-center gap-2 font-display italic" style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {language === 'en' ? 'Searching…' : 'Se caută…'}
                </div>
              ) : fetchError ? (
                <div className="px-4 py-5 text-center font-display italic" style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                  {language === 'en' ? 'Search is unavailable right now.' : 'Căutarea nu este disponibilă acum.'}
                </div>
              ) : results.length > 0 ? (
                results.map((article) => {
                  const cat = categories.find((c) => c.id === article.categoryId);
                  const thumb = articleCoverUrl(article);
                  return (
                    <button
                      key={article.id}
                      onClick={() => handleSelect(article)}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left focus:outline-none"
                      style={{ borderBottom: '1px solid var(--line-soft)', background: 'transparent' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-subtle-strong)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="h-11 w-11 overflow-hidden shrink-0" style={{ border: '1px solid var(--line)' }}>
                        {thumb && (
                          <img
                            src={thumb}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-display italic m-0 truncate"
                          style={{ color: 'var(--parchment)', fontSize: 17, lineHeight: 1.2 }}
                        >
                          {getLocalized(article, 'title', language)}
                        </p>
                        {cat && (
                          <p
                            className="font-ui text-[10px] uppercase mt-1 truncate"
                            style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}
                          >
                            {getLocalized(cat, 'name', language)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-5 text-center font-display italic" style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                  {language === 'en' ? 'No stories found.' : 'Nu am găsit povești.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileRow: React.FC<{ num: number; to: string; label: string; sub?: string; onNav: () => void }> = ({ num, to, label, sub, onNav }) => (
  <Link
    to={to}
    onClick={onNav}
    className="flex items-center gap-4 px-6 py-3 transition-colors"
    style={{ color: 'var(--text)', textDecoration: 'none' }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-subtle-strong)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    <span
      className="font-display italic"
      style={{ width: 22, textAlign: 'center', color: 'var(--gold)', fontSize: 15 }}
    >
      {String(num).padStart(2, '0')}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-display italic text-[17px] leading-tight" style={{ color: 'var(--parchment)' }}>{label}</span>
      {sub && <span className="block font-ui text-[10px] tracking-[0.15em] uppercase mt-1" style={{ color: 'var(--text-mute)' }}>{sub}</span>}
    </span>
    <span style={{ color: 'var(--text-mute)' }}>›</span>
  </Link>
);
