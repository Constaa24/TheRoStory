import React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { User, Menu, X, Search, Sun, Moon, Loader2, Heart, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Article, Category, searchArticles, fetchCategories, fetchRandomArticle, getLocalized, SEARCH_MIN_LENGTH } from "@/lib/supabase";
import { articleCoverUrl, countLabel } from "@/lib/article-utils";
import { kindPhrase, placeAndTime } from "@/lib/story-facts";
import { storageImage } from "@/lib/image-url";
import { Thread } from "@/components/story/Ornaments";

/** ⌘K on a Mac, Ctrl K elsewhere: what the shortcut hint on the search button says. */
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * The site's frame at the top of every page (the redesign's RoStory shell):
 * logo, five places to go, search, language and theme, the account menu and
 * Support. Below 1180 px the places fold into a menu; below 760 px language
 * and theme move into it too.
 */
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
  const en = language === "en";

  useFocusTrap(mobileMenuRef, isMenuOpen);
  // Trap focus in the profile dropdown while open and restore it to the
  // trigger on close — keyboard users could previously tab straight past
  // an open menu into the page underneath.
  useFocusTrap(profileDropdownRef, profileOpen);

  // A new page closes whatever was open over the old one.
  React.useEffect(() => {
    setIsMenuOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isMenuOpen && !profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsMenuOpen(false);
      setProfileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMenuOpen, profileOpen]);

  React.useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileRootRef.current && !profileRootRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  // ⌘K / Ctrl K opens search from anywhere, as the button's hint says.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setIsMenuOpen(false);
      setProfileOpen(false);
      setSearchOpen((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showDashboard = isAdmin || isWriter;
  const isDark = resolvedTheme !== "light";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const themeLabel = isDark ? (en ? "Switch to light mode" : "Mod luminos") : (en ? "Switch to dark mode" : "Mod întunecat");

  const navLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.map"), path: "/map" },
    { name: t("nav.categories"), path: "/categories" },
    { name: t("nav.myStory"), path: "/my-story" },
    { name: t("nav.contactUs"), path: "/contact-us" },
  ];
  const isCurrent = (path: string) => location.pathname === path;

  const initial = (user?.displayName || user?.email || "U").charAt(0).toUpperCase();
  const tier = en ? "Wanderer · Member" : "Călător · Membru";

  const langSwitch = (long: boolean) => (
    <div className="sb-seg" role="group" aria-label={en ? "Language" : "Limba"}>
      {(["en", "ro"] as const).map((L) => (
        <button
          key={L}
          type="button"
          onClick={() => setLanguage(L)}
          aria-pressed={language === L}
          lang={L}
          className="sb-seg-btn"
          style={long ? { padding: "8px 14px", minHeight: 40 } : { padding: "6px 11px", minHeight: 32, fontSize: 12, fontWeight: 700 }}
        >
          {long ? (L === "en" ? "English" : "Română") : L.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <header className="ed-nav">
        <div className="ed-container flex items-center gap-5" style={{ height: 72 }}>
          <Link to="/" className="flex items-center gap-3 shrink-0" aria-label={en ? "The RoStory, home" : "The RoStory, acasă"}>
            <picture>
              <source type="image/webp" srcSet="/logo-128.webp" />
              <img src="/logo-128.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            </picture>
            {/* Hidden only on the narrowest phones, where it would push the
                buttons off the edge. */}
            <span className="rs-wordmark hidden min-[380px]:inline">The RoStory</span>
          </Link>

          {/* The page you are on is marked with a knot. */}
          <nav className="hidden min-[1180px]:flex items-center gap-0.5 ml-2" aria-label={en ? "Main" : "Principal"}>
            {navLinks.map((link) => {
              const active = isCurrent(link.path);
              return (
                <Link key={link.path} to={link.path} aria-current={active ? "page" : undefined} className="rs-navlink">
                  {link.name}
                  <span aria-hidden="true" className="sb-knot sb-knot-sm" style={{ opacity: active ? 1 : 0 }} />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            {/* One accessible name at every width: the words are only
                visually hidden on narrow screens, where the icon stands in. */}
            <button
              type="button"
              onClick={() => { setIsMenuOpen(false); setProfileOpen(false); setSearchOpen((s) => !s); }}
              aria-expanded={searchOpen}
              aria-haspopup="dialog"
              aria-keyshortcuts="Meta+K Control+K"
              className="rs-pill"
            >
              <Search className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only min-[1280px]:not-sr-only min-[1280px]:whitespace-nowrap">{en ? "Search the archive" : "Caută în arhivă"}</span>
              <kbd aria-hidden="true" className="rs-kbd hidden min-[1280px]:inline whitespace-nowrap">{isMac ? "⌘K" : "Ctrl K"}</kbd>
            </button>

            <div className="hidden min-[760px]:flex items-center gap-2.5">
              {langSwitch(false)}
              <button type="button" onClick={toggleTheme} aria-label={themeLabel} className="sb-icon-btn grid" style={{ width: 42, height: 42 }}>
                {isDark ? <Sun className="w-4 h-4" strokeWidth={1.75} /> : <Moon className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </div>

            <div ref={profileRootRef} className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); setProfileOpen((o) => !o); }}
                aria-label={en ? "Account" : "Cont"}
                aria-expanded={profileOpen}
                aria-haspopup="dialog"
                className="sb-icon-btn grid"
                style={{ width: 42, height: 42, overflow: "hidden", padding: 0 }}
              >
                {user ? (
                  <UserPicture src={user.avatarUrl} alt={user.displayName || user.email || ""} initial={initial} className="text-lg" />
                ) : (
                  <User className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>

              {profileOpen && (
                <div ref={profileDropdownRef} role="dialog" aria-label={en ? "Account" : "Cont"} className="rs-pop absolute right-0 z-[70] rs-in" style={{ top: "calc(100% + 14px)" }}>
                  {user ? (
                    <>
                      <div className="flex items-center gap-4" style={{ padding: "24px 24px 20px" }}>
                        <span
                          className="grid place-items-center overflow-hidden shrink-0"
                          style={{ width: 48, height: 58, borderRadius: "50% 50% 9px 9px / 36% 36% 9px 9px", fontFamily: "var(--display)", fontStyle: "italic", fontWeight: 600, fontSize: 22 }}
                        >
                          <UserPicture src={user.avatarUrl} alt="" initial={initial} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate" style={{ fontFamily: "var(--display)", fontSize: 23, lineHeight: 1.1, color: "var(--parchment)" }}>
                            {user.displayName || user.email}
                          </div>
                          <div className="mt-0.5" style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{tier}</div>
                        </div>
                      </div>
                      <Thread style={{ opacity: 0.3 }} />
                      <div className="py-2">
                        <AccountRow num={1} to="/profile?tab=settings" label={t("nav.profile")} sub={en ? "Account & settings" : "Cont și setări"} onNav={() => setProfileOpen(false)} />
                        <AccountRow num={2} to="/profile?tab=favorites" label={t("nav.favorites")} sub={en ? "Saved stories" : "Povești salvate"} onNav={() => setProfileOpen(false)} />
                        {showDashboard && (
                          <AccountRow num={3} to="/admin" label={isAdmin ? t("nav.admin") : t("nav.dashboard")} sub={en ? "Editorial dashboard" : "Panou editorial"} onNav={() => setProfileOpen(false)} />
                        )}
                      </div>
                      <Thread style={{ opacity: 0.3 }} />
                      <button type="button" onClick={() => { logout(); setProfileOpen(false); }} className="rs-logout">
                        {t("nav.logout")}
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: 26 }}>
                      <p className="rs-kicker" style={{ marginBottom: 6 }}>{en ? "Welcome, traveller" : "Bine ai venit, călătorule"}</p>
                      <h2 className="rs-title" style={{ margin: "0 0 10px" }}>{en ? "Sign in to The RoStory." : "Intră în The RoStory."}</h2>
                      <p className="m-0 mb-5 text-[15px] leading-[1.55]" style={{ color: "var(--text-dim)" }}>
                        {en
                          ? "Keep the stories you love on your own shelf, and leave a note for the writers."
                          : "Păstrează poveștile dragi pe raftul tău și lasă o notă scriitorilor."}
                      </p>
                      <button type="button" onClick={() => { setProfileOpen(false); login(); }} className="sb-btn w-full">
                        {en ? "Continue with email" : "Continuă cu email"}
                      </button>
                      <div className="flex items-center gap-3 my-3.5" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                        <span aria-hidden="true" className="sb-thread" style={{ flex: 1, opacity: 0.35 }} />
                        <span>{en ? "or" : "sau"}</span>
                        <span aria-hidden="true" className="sb-thread" style={{ flex: 1, opacity: 0.35 }} />
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
                        <span aria-hidden="true" style={{ fontWeight: 800 }}>G</span>
                        {en ? "Continue with Google" : "Continuă cu Google"}
                      </button>
                      <p className="text-center m-0 mt-4" style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--text-dim)" }}>
                        {en ? "New here? " : "Nou aici? "}
                        <Link to="/auth?mode=signup" onClick={() => setProfileOpen(false)} className="rs-underline">
                          {en ? "Create an account" : "Creează cont"}
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link to="/support" className="rs-support hidden min-[1180px]:inline-flex">
              <Heart className="w-[15px] h-[15px]" strokeWidth={1.75} aria-hidden="true" />
              {t("nav.support")}
            </Link>

            <button
              type="button"
              onClick={() => { setProfileOpen(false); setIsMenuOpen((o) => !o); }}
              aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={isMenuOpen}
              className="sb-icon-btn grid min-[1180px]:hidden"
              style={{ width: 42, height: 42 }}
            >
              {isMenuOpen ? <X className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Menu className="w-[18px] h-[18px]" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div ref={mobileMenuRef} role="dialog" aria-modal="true" aria-label={en ? "Menu" : "Meniu"} className="rs-menu min-[1180px]:hidden rs-in">
            <div className="mx-auto" style={{ maxWidth: 640, padding: "32px clamp(20px, 5vw, 40px) 40px" }}>
              <p className="rs-kicker" style={{ marginBottom: 12 }}>{en ? "Where to?" : "Încotro?"}</p>
              {[...navLinks, { name: t("nav.support"), path: "/support" }].map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={isCurrent(link.path) ? "page" : undefined}
                  className="rs-menu-link"
                >
                  {link.name}
                  <ArrowRight className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} style={{ color: "var(--gold)" }} aria-hidden="true" />
                </Link>
              ))}
              <div className="flex flex-wrap items-center gap-3" style={{ paddingTop: 28 }}>
                {langSwitch(true)}
                <button type="button" onClick={toggleTheme} className="sb-btn sb-btn-ghost">
                  {isDark ? <Sun className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> : <Moon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  {themeLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Portalled: the header's backdrop blur makes it the containing block
          for anything position:fixed inside it, so a full-screen layer
          there would be clipped to the header. */}
      {searchOpen && createPortal(<SearchDialog onClose={() => setSearchOpen(false)} language={language} />, document.body)}
    </>
  );
};

/**
 * Search, as a dialog over the page: the box, then the stories that match
 * (arrow keys move through them, Enter opens one), and when there is
 * nothing to show, a few places to wander instead.
 */
const SearchDialog: React.FC<{ onClose: () => void; language: "en" | "ro" }> = ({ onClose, language }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Article[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<number | undefined>(undefined);
  const reqIdRef = React.useRef(0);
  const en = language === "en";

  // The trap first, so it remembers what had focus before (the search
  // button) and hands focus back there on close; then into the box.
  useFocusTrap(dialogRef, true);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        setSelected(0);
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

  const open = (article: Article) => {
    onClose();
    navigate(`/article/${article.id}`, { state: { from } });
  };

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleRandom = async () => {
    // A failed lookup leaves the dialog as it is rather than surfacing as an
    // unhandled rejection.
    const a = await fetchRandomArticle().catch(() => null);
    if (!a) return;
    onClose();
    navigate(`/article/${a.id}`, { state: { from } });
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[selected]) { e.preventDefault(); open(results[selected]); }
  };

  // Keep the highlighted row in view as the arrows move it.
  React.useEffect(() => {
    document.getElementById(`nav-search-r${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const trimmed = query.trim();
  const showResults = trimmed.length > 0;
  const isBelowMinLength = showResults && trimmed.length < SEARCH_MIN_LENGTH;
  const quiet = (text: React.ReactNode) => (
    <p className="m-0 text-center" style={{ padding: "22px 12px", fontFamily: "var(--display)", fontStyle: "italic", fontSize: 20, color: "var(--text-dim)" }}>{text}</p>
  );

  return (
    <div className="no-print">
      <div className="fixed inset-0 z-[90]" style={{ background: "var(--overlay-deep)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-x-0 z-[91] flex justify-center px-4 pointer-events-none top-3 sm:top-[88px]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-search-title"
          className="rs-search pointer-events-auto rs-in"
        >
          <div className="flex items-center justify-between gap-4" style={{ padding: "22px 26px 0" }}>
            <p className="rs-kicker" id="nav-search-title">{en ? "Search the archive" : "Caută în arhivă"}</p>
            <button type="button" onClick={onClose} className="sb-icon-btn grid" style={{ width: 36, height: 36 }} aria-label={en ? "Close search" : "Închide căutarea"}>
              <X className="w-[15px] h-[15px]" strokeWidth={1.75} />
            </button>
          </div>
          <div className="relative" style={{ margin: "8px 26px 0" }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              aria-labelledby="nav-search-title"
              aria-describedby="nav-search-hint"
              aria-activedescendant={results.length ? `nav-search-r${selected}` : undefined}
              placeholder={en ? "Try ‘Voroneț’, ‘salt mines’, ‘Mărțișor’…" : "Încearcă ‘Voroneț’, ‘saline’, ‘Mărțișor’…"}
              className="rs-search-input"
            />
            {isSearching ? (
              <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 w-[22px] h-[22px] animate-spin pointer-events-none" style={{ color: "var(--gold)" }} aria-hidden="true" />
            ) : (
              <Search className="absolute right-1 top-1/2 -translate-y-1/2 w-[22px] h-[22px] pointer-events-none" strokeWidth={1.75} style={{ color: "var(--gold)" }} aria-hidden="true" />
            )}
          </div>
          <p id="nav-search-hint" className="m-0" style={{ margin: "10px 26px 0", fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, color: "var(--text-mute)" }}>
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
              once there was finally a browser to catch it in. The "wander"
              chips sit outside it for the same reason: they are there from
              the start, and must not make the region announce on opening. */}
          <div role="status" aria-live="polite" className="overflow-y-auto" style={{ maxHeight: "min(52vh, 460px)", padding: showResults ? "12px 14px 8px" : 0 }}>
            {!showResults ? null : isBelowMinLength ? (
              quiet(en
                ? `Keep typing — at least ${SEARCH_MIN_LENGTH} characters.`
                : `Continuă să scrii — cel puțin ${SEARCH_MIN_LENGTH} caractere.`)
            ) : isSearching && results.length === 0 ? (
              <p className="m-0 flex items-center justify-center gap-2" style={{ padding: "22px 12px", fontFamily: "var(--display)", fontStyle: "italic", fontSize: 20, color: "var(--text-dim)" }}>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {en ? "Searching…" : "Se caută…"}
              </p>
            ) : fetchError ? (
              quiet(en ? "Search is unavailable right now." : "Căutarea nu este disponibilă acum.")
            ) : results.length > 0 ? (
              <>
                <p className="m-0" style={{ margin: "6px 12px 8px", fontFamily: "var(--ui)", fontSize: 12, fontWeight: 600, color: "var(--text-mute)" }}>
                  {en ? `${countLabel(results.length, "story", "en")} found` : `${countLabel(results.length, "story", "ro")} găsite`}
                </p>
                <ul className="list-none m-0 p-0">
                  {results.map((article, i) => {
                    const cat = categories.find((c) => c.id === article.categoryId);
                    const thumb = storageImage(articleCoverUrl(article), "thumb");
                    const where = placeAndTime(article, language) || (cat ? getLocalized(cat, "name", language) : null);
                    return (
                      <li key={article.id}>
                        <button
                          id={`nav-search-r${i}`}
                          type="button"
                          onClick={() => open(article)}
                          onMouseEnter={() => setSelected(i)}
                          className={cn("rs-result", i === selected && "is-selected")}
                        >
                          <span className="rs-result-thumb">{thumb && <img src={thumb} alt="" className="rs-result-img" />}</span>
                          <span className="flex flex-col gap-0.5 min-w-0">
                            {where && <span className="rs-result-where">{where}</span>}
                            <span style={{ fontFamily: "var(--display)", fontSize: 22, lineHeight: 1.15, color: "var(--parchment)" }}>
                              {getLocalized(article, "title", language)}
                            </span>
                          </span>
                          <span className="hidden sm:block whitespace-nowrap" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                            {kindPhrase(article, language)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              quiet(en ? "No stories found." : "Nu am găsit povești.")
            )}
          </div>

          {(!showResults || (!isSearching && results.length === 0 && !isBelowMinLength)) && (
            <div className="flex flex-col items-center gap-3.5" style={{ padding: "22px 26px 18px" }}>
              <p className="m-0" style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 600, color: "var(--text-mute)" }}>{en ? "Or wander instead" : "Sau rătăcește puțin"}</p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {categories.slice(0, 2).map((c) => (
                  <button key={c.id} type="button" className="rs-chip" onClick={() => goTo(`/category/${c.id}`)}>
                    {getLocalized(c, "name", language)}
                  </button>
                ))}
                <button type="button" className="rs-chip" onClick={() => goTo("/map")}>{en ? "Open the map" : "Deschide harta"}</button>
                <button type="button" className="rs-chip" onClick={handleRandom}>{en ? "A story at random" : "O poveste la întâmplare"}</button>
              </div>
            </div>
          )}

          {/* Keys only mean something with a keyboard; phones skip the line. */}
          <div aria-hidden="true" className="hidden sm:flex justify-end gap-[18px]" style={{ padding: "12px 26px", borderTop: "1px solid var(--line-soft)", fontFamily: "var(--ui)", fontSize: 11.5, color: "var(--text-mute)" }}>
            <span>↑ ↓ {en ? "to move" : "mută"}</span>
            <span>↵ {en ? "to open" : "deschide"}</span>
            <span>esc {en ? "to close" : "închide"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The reader's picture, or their initial when there is none or it fails to
 * load. Deliberately not the shadcn <Avatar>: that is Radix, and Radix is
 * bundled as one chunk, so the navbar — on every page — made every first
 * visit download all of it (~88 KB) for one round picture. Dialogs and
 * menus that need Radix load it with the pages that use them.
 */
const UserPicture: React.FC<{ src?: string; alt: string; initial: string; className?: string }> = ({ src, alt, initial, className }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  if (src && !failed) {
    return <img src={storageImage(src, "avatar")} alt={alt} className="w-full h-full object-cover" onError={() => setFailed(true)} />;
  }
  return (
    <span
      className={cn("grid place-items-center w-full h-full font-display italic font-semibold", className)}
      style={{ background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)", color: "var(--on-gold)" }}
    >
      {initial}
    </span>
  );
};

const AccountRow: React.FC<{ num: number; to: string; label: string; sub?: string; onNav: () => void }> = ({ num, to, label, sub, onNav }) => (
  <Link to={to} onClick={onNav} className="rs-row">
    <span className="rs-num" aria-hidden="true">{String(num).padStart(2, "0")}</span>
    <span className="flex-1 min-w-0">
      <span className="block" style={{ fontFamily: "var(--ui)", fontSize: 14, fontWeight: 700, color: "var(--parchment)" }}>{label}</span>
      {sub && <span className="block" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>{sub}</span>}
    </span>
    <span aria-hidden="true" style={{ color: "var(--text-mute)" }}>›</span>
  </Link>
);
