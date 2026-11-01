import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { User, Menu, X, Search, Sun, Moon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Article, Category, searchArticles, fetchCategories, fetchRandomArticle, getLocalized, SEARCH_MIN_LENGTH } from "@/lib/supabase";
import { articleCoverUrl, countLabel } from "@/lib/article-utils";
import { kindPhrase, placeAndTime, toRoman } from "@/lib/story-facts";
import { storageImage } from "@/lib/image-url";
import { Thread } from "@/components/story/Ornaments";

export const Navbar: React.FC = () => {
  const { user, login, logout, isAdmin, isWriter, signInWithGoogle } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  // resolvedTheme, not theme: next-themes has enableSystem on by default, so
  // `theme` can be the literal "system" while the page renders light. Reading
  // `theme` then made isDark true on a light page — the toggle showed the
  // wrong icon and its first click ("set light") was a no-op, leaving it
  // stuck. resolvedTheme is always the concrete "light" | "dark" in effect.
  const { resolvedTheme, setTheme } = useTheme();
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
  const isDark = resolvedTheme !== 'light';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
  const themeLabel = isDark ? (language === 'en' ? 'Switch to light mode' : 'Mod luminos') : (language === 'en' ? 'Switch to dark mode' : 'Mod întunecat');

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

  const langSwitch = (
    <div className="sb-seg" role="group" aria-label={language === 'en' ? 'Language' : 'Limba'}>
      {(['en', 'ro'] as const).map(L => (
        <button
          key={L}
          type="button"
          onClick={() => setLanguage(L)}
          aria-pressed={language === L}
          lang={L}
          className="sb-seg-btn"
          style={{ padding: '6px 12px', minHeight: 32 }}
        >
          {L.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <header className="ed-nav" style={{ borderBottom: 0 }}>
      <div className="ed-container flex items-center justify-between gap-6" style={{ paddingTop: 16, paddingBottom: 14, minHeight: 80 }}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <picture>
            <source type="image/webp" srcSet="/logo.webp" />
            <img src="/logo.png" alt="The RoStory" width={44} height={44} className="h-[44px] w-[44px] object-contain" />
          </picture>
          <span
            className="font-display italic font-semibold text-[25px] whitespace-nowrap hidden sm:inline"
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

        {/* Desktop nav: the page you are on is marked with a knot. */}
        <nav className="hidden lg:flex items-center gap-1" aria-label={language === 'en' ? 'Main' : 'Principal'}>
          {navLinks.map(link => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={active ? 'page' : undefined}
                className="px-3.5 pt-2 pb-1 font-display italic font-medium text-[20px] leading-none transition-colors hover:text-gold flex flex-col items-center gap-2"
                style={{ color: active ? 'var(--gold)' : 'var(--text)' }}
              >
                {link.name}
                <span aria-hidden="true" className="sb-knot sb-knot-sm" style={{ opacity: active ? 1 : 0 }} />
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSearchOpen(s => !s)}
            aria-label={language === 'en' ? 'Search' : 'Caută'}
            aria-expanded={searchOpen}
            className="sb-icon-btn"
            style={{ width: 42, height: 42 }}
          >
            <Search className="sb-ico" />
          </button>

          <div className="hidden md:flex">{langSwitch}</div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            className="sb-icon-btn hidden md:grid"
            style={{ width: 42, height: 42 }}
          >
            {isDark ? <Sun className="sb-ico" /> : <Moon className="sb-ico" />}
          </button>

          {/* Profile / Account */}
          <div ref={profileRootRef} className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setProfileOpen(o => !o); }}
              aria-label={language === 'en' ? 'Account' : 'Cont'}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              className="sb-icon-btn"
              style={{
                width: 42,
                height: 42,
                background: user ? 'var(--glow)' : 'transparent',
                overflow: 'hidden',
              }}
            >
              {user?.avatarUrl ? (
                <Avatar className="h-full w-full">
                  <AvatarImage src={storageImage(user.avatarUrl, "avatar")} alt={user.displayName || user.email || ''} />
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
                <User className="sb-ico" />
              )}
            </button>

            {profileOpen && (
              <div
                ref={profileDropdownRef}
                className="absolute right-0 z-[60] screen-anim"
                style={{
                  top: 'calc(100% + 14px)',
                  width: 330,
                  background: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 18,
                  boxShadow: 'var(--shadow-dropdown)',
                  overflow: 'hidden',
                }}
              >
                {user ? (
                  <>
                    <div className="px-6 pt-6 pb-5">
                      <div className="flex items-center gap-4">
                        <span
                          className="sb-arch grid place-items-center overflow-hidden shrink-0"
                          style={{
                            width: 48,
                            height: 56,
                            background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)',
                            color: 'var(--ink)',
                            fontFamily: 'var(--display)',
                            fontStyle: 'italic',
                            fontWeight: 600,
                            fontSize: 20,
                          }}
                        >
                          {user.avatarUrl ? (
                            <Avatar className="h-full w-full rounded-none">
                              <AvatarImage src={storageImage(user.avatarUrl, "avatar")} alt={user.displayName || user.email || ''} className="object-cover" />
                              <AvatarFallback className="bg-transparent rounded-none text-[color:var(--ink)] font-display italic font-semibold">{initial}</AvatarFallback>
                            </Avatar>
                          ) : initial}
                        </span>
                        <div className="min-w-0">
                          <div className="font-display italic text-[21px] leading-tight truncate" style={{ color: 'var(--parchment)' }}>
                            {user.displayName || user.email}
                          </div>
                          <div className="sb-kicker-sm mt-0.5" style={{ fontSize: 16 }}>{tier}</div>
                        </div>
                      </div>
                    </div>
                    <Thread style={{ opacity: 0.3 }} />
                    <div className="py-2">
                      <ProfileRow num={1} to="/profile" label={t('nav.profile')} sub={language === 'en' ? 'Account & settings' : 'Cont și setări'} onNav={() => setProfileOpen(false)} />
                      <ProfileRow num={2} to="/profile?tab=favorites" label={t('nav.favorites')} sub={language === 'en' ? 'Saved stories' : 'Povești salvate'} onNav={() => setProfileOpen(false)} />
                      {showDashboard && (
                        <ProfileRow num={3} to="/admin" label={isAdmin ? t('nav.admin') : t('nav.dashboard')} sub={language === 'en' ? 'Editorial dashboard' : 'Panou editorial'} onNav={() => setProfileOpen(false)} />
                      )}
                    </div>
                    <Thread style={{ opacity: 0.3 }} />
                    <button
                      type="button"
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full text-left px-6 py-4 font-ui text-[14px] font-semibold cursor-pointer transition-colors"
                      style={{ background: 'transparent', border: 0, color: 'var(--danger)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <div className="p-6">
                    <p className="sb-kicker mb-1.5">{language === 'en' ? 'Welcome, traveller' : 'Bine ai venit, călătorule'}</p>
                    <h4 className="sb-h4 mb-3" style={{ fontSize: 27 }}>
                      {language === 'en' ? 'Sign in to The RoStory.' : 'Intră în The RoStory.'}
                    </h4>
                    <p className="sb-dim text-[15px] leading-relaxed mb-5">
                      {language === 'en'
                        ? 'Keep the stories you love on your own shelf, and leave a note for the writers.'
                        : 'Păstrează poveștile dragi pe raftul tău și lasă o notă scriitorilor.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); login(); }}
                      className="sb-btn w-full"
                    >
                      {language === 'en' ? 'Continue with email' : 'Continuă cu email'}
                    </button>
                    <div className="flex items-center gap-3 my-4 sb-meta">
                      <span aria-hidden="true" className="sb-thread" style={{ flex: 1 }} />
                      <span>{language === 'en' ? 'or' : 'sau'}</span>
                      <span aria-hidden="true" className="sb-thread" style={{ flex: 1 }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Actually start the Google OAuth flow — this used to
                        // just navigate to /auth, despite the label.
                        setProfileOpen(false);
                        void signInWithGoogle();
                      }}
                      className="sb-btn sb-btn-ghost w-full"
                    >
                      <span className="w-4 h-4 grid place-items-center font-bold" aria-hidden="true">G</span>
                      {language === 'en' ? 'Continue with Google' : 'Continuă cu Google'}
                    </button>
                    <p className="text-center mt-4 sb-meta" style={{ color: 'var(--text-dim)' }}>
                      {language === 'en' ? 'New here? ' : 'Nou aici? '}
                      <Link to="/auth?mode=signup" onClick={() => setProfileOpen(false)} className="sb-link">
                        {language === 'en' ? 'Create an account' : 'Creează cont'}
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(o => !o)}
            aria-label={isMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={isMenuOpen}
            className="sb-icon-btn lg:hidden"
            style={{ width: 42, height: 42 }}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <Thread style={{ opacity: 0.28 }} />

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
          className="lg:hidden screen-anim"
          style={{ background: 'var(--overlay-nav)' }}
        >
          <div className="ed-container flex flex-col" style={{ paddingTop: 56, paddingBottom: 72 }}>
            <p className="sb-kicker text-center mb-6">{language === 'en' ? 'Where to?' : 'Încotro?'}</p>
            {navLinks.map(link => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('px-2 py-4 font-display italic text-[28px] leading-none transition-colors flex items-center gap-4')}
                  style={{
                    color: active ? 'var(--gold)' : 'var(--parchment)',
                    borderBottom: '1px dashed var(--line)',
                  }}
                >
                  <span aria-hidden="true" className="sb-knot sb-knot-sm" style={{ opacity: active ? 1 : 0.35 }} />
                  {link.name}
                </Link>
              );
            })}
            <div className="flex items-center justify-center gap-4 pt-10">
              {langSwitch}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeLabel}
                className="sb-icon-btn"
              >
                {isDark ? <Sun className="sb-ico" /> : <Moon className="sb-ico" />}
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
  const location = useLocation();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Article[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<number | undefined>(undefined);
  const reqIdRef = React.useRef(0);
  const en = language === 'en';

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
    // Below the trigram threshold we don't query at all — see
    // SEARCH_MIN_LENGTH. Bail before the debounce so a one-letter query
    // never reaches the network and the spinner never appears.
    if (q.length < SEARCH_MIN_LENGTH) {
      setResults([]);
      setFetchError(false);
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

  // Carry the current location through so the article page's Back button
  // returns the reader where they were. Without the state it fell back to
  // "/" and silently dropped them on the homepage.
  const from = `${location.pathname}${location.search}`;

  const handleSelect = (article: Article) => {
    onClose();
    navigate(`/article/${article.id}`, { state: { from } });
  };

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleRandom = async () => {
    const a = await fetchRandomArticle();
    if (!a) return;
    onClose();
    navigate(`/article/${a.id}`, { state: { from } });
  };

  const showResults = query.trim().length > 0;
  const isBelowMinLength = query.trim().length > 0 && query.trim().length < SEARCH_MIN_LENGTH;
  const quiet = (text: React.ReactNode) => (
    <p className="px-3 py-6 text-center font-display italic m-0" style={{ color: 'var(--text-dim)', fontSize: 19 }}>{text}</p>
  );

  return (
    <div className="screen-anim" style={{ background: 'var(--overlay-nav)' }}>
      <div className="ed-container" style={{ paddingTop: 40, paddingBottom: 56 }}>
        <div className="max-w-[820px] mx-auto">
          <div className="flex items-center justify-between gap-4">
            <p className="sb-kicker m-0" id="nav-search-title">{en ? 'Search the archive' : 'Caută în arhivă'}</p>
            <button
              type="button"
              onClick={onClose}
              className="sb-icon-btn"
              style={{ width: 40, height: 40 }}
              aria-label={en ? 'Close search' : 'Închide căutarea'}
            >
              <X className="sb-ico" />
            </button>
          </div>
          <div className="relative mt-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-labelledby="nav-search-title"
              placeholder={en ? "Try 'Voroneț', 'salt mines', 'Mărțișor'…" : "Încearcă 'Voroneț', 'saline', 'Mărțișor'…"}
              className="w-full text-[30px] sm:text-[44px]"
              style={{
                background: 'transparent',
                border: 0,
                borderBottom: '2px solid var(--gold-deep)',
                borderRadius: 0,
                padding: '10px 48px 14px 2px',
                fontFamily: 'var(--display)',
                fontStyle: 'italic',
                lineHeight: 1.15,
                color: 'var(--parchment)',
              }}
            />
            {isSearching ? (
              <Loader2
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 animate-spin pointer-events-none"
                style={{ color: 'var(--gold)' }}
              />
            ) : (
              <Search
                aria-hidden="true"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none"
                style={{ color: 'var(--gold)' }}
              />
            )}
          </div>
          <p className="sb-meta mt-2.5">
            {en
              ? `Accents are optional. Type at least ${SEARCH_MIN_LENGTH} letters.`
              : `Diacriticele sunt opționale. Scrie cel puțin ${SEARCH_MIN_LENGTH} litere.`}
          </p>

          {/* aria-live: results swap in without any focus change, so a
              screen-reader user previously got no signal that the search had
              returned anything. "polite" so it waits for a pause in typing
              rather than interrupting each keystroke.

              The container stays mounted even when there is no query, and only
              its contents change. A live region that enters the DOM already
              holding its text is frequently never announced at all: NVDA and
              JAWS report mutations inside a region they are already observing,
              so the region has to be there first. Caught by e2e/keyboard.spec
              once there was finally a browser to catch it in. */}
          <div
            role="status"
            aria-live="polite"
            className="overflow-y-auto"
            style={{ marginTop: showResults ? 28 : 0, maxHeight: 'min(56vh, 520px)' }}
          >
            {!showResults ? null : isBelowMinLength ? (
              quiet(en
                ? `Keep typing — at least ${SEARCH_MIN_LENGTH} characters.`
                : `Continuă să scrii — cel puțin ${SEARCH_MIN_LENGTH} caractere.`)
            ) : isSearching && results.length === 0 ? (
              <p className="px-3 py-6 flex items-center justify-center gap-2 font-display italic m-0" style={{ color: 'var(--text-dim)', fontSize: 19 }}>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {en ? 'Searching…' : 'Se caută…'}
              </p>
            ) : fetchError ? (
              quiet(en ? 'Search is unavailable right now.' : 'Căutarea nu este disponibilă acum.')
            ) : results.length > 0 ? (
              <>
                <p className="sb-kicker-sm mb-2.5" style={{ color: 'var(--text-dim)' }}>
                  {en
                    ? `${countLabel(results.length, 'story', 'en')} found`
                    : `${countLabel(results.length, 'story', 'ro')} găsite`}
                </p>
                <Thread style={{ opacity: 0.35 }} />
                <ul className="list-none m-0 p-0">
                  {results.map((article) => {
                    const cat = categories.find((c) => c.id === article.categoryId);
                    const thumb = storageImage(articleCoverUrl(article), "thumb");
                    const where = placeAndTime(article, language) || (cat ? getLocalized(cat, 'name', language) : null);
                    return (
                      <li key={article.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(article)}
                          className="w-full grid items-center gap-4 sm:gap-5 px-2 sm:px-3 py-3.5 text-left transition-colors grid-cols-[60px_minmax(0,1fr)] sm:grid-cols-[68px_minmax(0,1fr)_auto]"
                          style={{ background: 'transparent', border: 0, borderRadius: 14, cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--glow)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span className="sb-arch sb-arch-thumb block" style={{ aspectRatio: '1' }}>
                            {thumb && <img src={thumb} alt="" aria-hidden="true" />}
                          </span>
                          <span className="flex flex-col gap-1 min-w-0">
                            {where && <span className="sb-kicker-sm truncate" style={{ fontSize: 16 }}>{where}</span>}
                            <span className="font-display italic" style={{ color: 'var(--parchment)', fontSize: 23, lineHeight: 1.15 }}>
                              {getLocalized(article, 'title', language)}
                            </span>
                          </span>
                          <span className="sb-meta hidden sm:block whitespace-nowrap">{kindPhrase(article, language)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Thread style={{ opacity: 0.35 }} />
              </>
            ) : (
              quiet(en ? 'No stories found.' : 'Nu am găsit povești.')
            )}
          </div>

          {(!showResults || (!isSearching && results.length === 0 && !isBelowMinLength)) && (
            <div className="flex flex-col items-center gap-3.5 mt-10">
              <p className="sb-kicker-sm m-0" style={{ color: 'var(--text-dim)' }}>{en ? 'Or wander instead' : 'Sau rătăcește puțin'}</p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {categories.slice(0, 2).map((c) => (
                  <button key={c.id} type="button" className="sb-chip" onClick={() => goTo(`/category/${c.id}`)}>
                    {getLocalized(c, 'name', language)}
                  </button>
                ))}
                <button type="button" className="sb-chip" onClick={() => goTo('/map')}>{en ? 'Open the map' : 'Deschide harta'}</button>
                <button type="button" className="sb-chip" onClick={handleRandom}>{en ? 'A story at random' : 'O poveste la întâmplare'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Thread style={{ opacity: 0.28 }} />
    </div>
  );
};

const ProfileRow: React.FC<{ num: number; to: string; label: string; sub?: string; onNav: () => void }> = ({ num, to, label, sub, onNav }) => (
  <Link
    to={to}
    onClick={onNav}
    className="flex items-center gap-4 px-6 py-3 transition-colors"
    style={{ color: 'var(--text)', textDecoration: 'none' }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--glow)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    <span className="sb-numeral" style={{ width: 28, textAlign: 'center', fontSize: 16 }}>
      {toRoman(num)}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-display italic text-[19px] leading-tight" style={{ color: 'var(--parchment)' }}>{label}</span>
      {sub && <span className="block sb-meta mt-0.5">{sub}</span>}
    </span>
    <span aria-hidden="true" style={{ color: 'var(--text-mute)' }}>›</span>
  </Link>
);
