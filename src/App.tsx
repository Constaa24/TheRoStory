import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import ScrollToTopOnRoute from "@/components/ui/ScrollToTopOnRoute";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { PaperOverlay } from "@/components/ui/PaperOverlay";
import { SocialLinks } from "@/components/ui/social-links";
import { Divider, Motif } from "@/components/story/Ornaments";
import { toast } from "sonner";
import { fetchCategories, Category } from "@/lib/supabase";

// next-themes@0.4.x dropped children from ThemeProviderProps for RSC compatibility;
// re-add it via a typed wrapper so JSX children work without errors.
const ThemedProvider = ThemeProvider as React.ComponentType<
  React.PropsWithChildren<{ attribute: string; defaultTheme: string }>
>;

type ErrorBoundaryProps = { fallback: React.ReactNode; children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // `declare` avoids useDefineForClassFields conflict with React 19 types
  declare state: ErrorBoundaryState;
  declare props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): ErrorBoundaryState { return { hasError: true }; }
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }
  override render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// After a deploy, content-hashed chunk filenames change and the old ones are
// removed from the server. A tab still running the previous build (browser or
// service-worker cache) then requests a chunk that 404s → Vercel's SPA rewrite
// returns index.html → the dynamic import fails. lazyWithReload catches that
// specific "stale chunk" failure once and reloads the page so the browser pulls
// the fresh index.html + current chunks, instead of crashing into the error
// boundary. A sessionStorage flag prevents a reload loop if the failure is real
// (e.g. an actually-broken deploy) rather than a stale-asset mismatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const isChunkError =
        error instanceof Error &&
        /dynamically imported module|Failed to fetch|importing a module script|module script/i.test(error.message);
      if (isChunkError) {
        try {
          const KEY = "rostory_chunk_reload_at";
          const last = Number(sessionStorage.getItem(KEY) || 0);
          // Only auto-reload if we haven't already tried within the last 10s.
          // A stale-asset mismatch self-heals on the first reload; a genuinely
          // broken deploy keeps failing, so the window guard lets it fall
          // through to the error boundary instead of looping. The timestamp
          // ages out, so a future deploy can heal again.
          if (Date.now() - last > 10_000) {
            sessionStorage.setItem(KEY, String(Date.now()));
            window.location.reload();
            // Never-resolving promise so nothing renders before the reload.
            return await new Promise<{ default: T }>(() => {});
          }
        } catch {
          /* sessionStorage unavailable — fall through to the error boundary */
        }
      }
      throw error;
    }
  });
}

// Lazy load pages for better performance
const Home = lazyWithReload(() => import("@/pages/Home"));
const MapPage = lazyWithReload(() => import("@/pages/Map"));
const Auth = lazyWithReload(() => import("@/pages/Auth"));
const ArticleDetail = lazyWithReload(() => import("@/pages/ArticleDetail"));
const AdminDashboard = lazyWithReload(() => import("@/pages/AdminDashboard"));
const VideoStoryCreate = lazyWithReload(() => import("@/pages/VideoStoryCreate"));
const CarouselStoryCreate = lazyWithReload(() => import("@/pages/CarouselStoryCreate"));
const TextStoryCreate = lazyWithReload(() => import("@/pages/TextStoryCreate"));
const Categories = lazyWithReload(() => import("@/pages/Categories"));
const CategoryDetail = lazyWithReload(() => import("@/pages/CategoryDetail"));
const Support = lazyWithReload(() => import("@/pages/Support"));
const MyStory = lazyWithReload(() => import("@/pages/MyStory"));
const ContactUs = lazyWithReload(() => import("@/pages/ContactUs"));
const Profile = lazyWithReload(() => import("@/pages/Profile"));
const AuthCallback = lazyWithReload(() => import("@/pages/AuthCallback"));
const Privacy = lazyWithReload(() => import("@/pages/Privacy"));
const Terms = lazyWithReload(() => import("@/pages/Terms"));
const NewsletterConfirm = lazyWithReload(() => import("@/pages/NewsletterConfirm"));
const NotFound = lazyWithReload(() => import("@/pages/NotFound"));

/**
 * The storybook's last page: a band of cross-stitch, the shelves, the fine
 * print, and a line about why stories matter.
 */
function StorybookFooter({ language }: { language: 'en' | 'ro' }) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const en = language === 'en';

  React.useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const linkClass = "text-[17px] transition-colors hover:text-gold";

  return (
    <footer className="no-print mt-32" style={{ background: 'var(--ink-2)' }}>
      <Motif style={{ opacity: 0.32 }} />
      <div className="ed-container grid grid-cols-1 md:grid-cols-[1.3fr_1fr_0.7fr] gap-12 items-start" style={{ paddingTop: 72, paddingBottom: 48 }}>
        <div className="flex flex-col gap-5">
          <Link to="/" className="flex items-center gap-3 self-start">
            <picture>
              <source type="image/webp" srcSet="/logo.webp" />
              <img src="/logo.png" alt="The RoStory" width={52} height={52} className="h-[52px] w-[52px] object-contain" />
            </picture>
            <span
              className="font-display italic font-semibold text-[29px] leading-none"
              style={{
                background: 'var(--logo-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.01em',
                padding: '0.1em 0',
              }}
            >
              The RoStory
            </span>
          </Link>
          <p className="sb-dim max-w-[380px] text-[17px] leading-relaxed">
            {en
              ? 'A reader-supported visual archive of the histories, traditions, landscapes and people of Romania. Published from Bucharest.'
              : 'O arhivă vizuală susținută de cititori cu istoriile, tradițiile, peisajele și oamenii României. Publicată din București.'}
          </p>
          <SocialLinks iconSize="sb-ico" className="gap-2.5" linkClassName="sb-icon-btn" />
        </div>
        <nav aria-label={en ? 'The shelves' : 'Rafturile'} className="flex flex-col gap-4">
          <p className="sb-kicker">{en ? 'The shelves' : 'Rafturile'}</p>
          <ul className="list-none p-0 m-0 grid grid-cols-2 gap-x-6 gap-y-3">
            {categories.map(cat => (
              <li key={cat.id}>
                <Link to={`/category/${cat.id}`} className={linkClass} style={{ color: 'var(--text)' }}>
                  {en ? cat.nameEn : cat.nameRo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={en ? 'The fine print' : 'Detalii'} className="flex flex-col gap-4">
          <p className="sb-kicker">{en ? 'The fine print' : 'Detalii'}</p>
          <ul className="list-none p-0 m-0 grid gap-3">
            <li><Link to="/privacy" className={linkClass} style={{ color: 'var(--text)' }}>{en ? 'Privacy policy' : 'Politica de confidențialitate'}</Link></li>
            <li><Link to="/terms" className={linkClass} style={{ color: 'var(--text)' }}>{en ? 'Terms' : 'Termeni'}</Link></li>
            <li><Link to="/contact-us" className={linkClass} style={{ color: 'var(--text)' }}>Contact</Link></li>
          </ul>
        </nav>
      </div>
      <div className="ed-container">
        <Divider />
        <div className="flex flex-wrap justify-between items-start gap-x-10 gap-y-5" style={{ paddingTop: 26, paddingBottom: 40 }}>
          <p className="sb-meta">
            © {new Date().getFullYear()} The RoStory · {en ? 'Made in Bucharest, with field notes from everywhere.' : 'Făcut în București, cu note de teren de pretutindeni.'}
          </p>
          <p className="font-display italic m-0 max-w-[560px] text-[18px] leading-[1.45]" style={{ color: 'var(--text-dim)' }}>
            {en
              ? '“Storytelling is the essential human activity. The harder the situation, the more essential it is.”'
              : '„Povestirea este activitatea umană esențială. Cu cât situația este mai grea, cu atât devine mai esențială.”'}
          </p>
        </div>
      </div>
    </footer>
  );
}

const App: React.FC = () => {
  const { isAdmin, isWriter, isLoading, user, isEmailVerified, sendVerification, isRecoveryMode } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = React.useState(false);

  const canAccessAdmin = isAdmin || isWriter;
  const isRecoveryAllowedPath = location.pathname === "/auth/callback" || location.pathname === "/reset-password";
  const recoveryRedirectBypass = Boolean((location.state as { bypassRecoveryRedirect?: boolean } | null)?.bypassRecoveryRedirect);
  const shouldRedirectForRecovery = isRecoveryMode && !isRecoveryAllowedPath && !recoveryRedirectBypass;
  const hideAppChrome = isRecoveryMode;

  // Let /auth/callback render even while auth is loading so it can exchange the
  // PKCE code. Blocking it behind isLoading can deadlock the auth flow.
  if (isLoading && location.pathname !== '/auth/callback') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <PaperOverlay />
        <div className="animate-pulse text-3xl font-display text-accent italic px-2 pb-1">The RoStory…</div>
      </div>
    );
  }

  if (shouldRedirectForRecovery) {
    return <Navigate to="/reset-password?mode=reset" replace />;
  }

  const handleResendVerification = async () => {
    setIsVerifying(true);
    try {
      const result = await sendVerification();
      if (result?.error) throw result.error;
      toast.success(language === 'en' ? "Verification email sent!" : "Email de verificare trimis!");
    } catch (error) {
      console.error(error);
      toast.error(language === 'en' ? "Failed to send verification email" : "Eroare la trimiterea email-ului de verificare");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <ThemedProvider attribute="class" defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground flex flex-col relative">
        <ScrollToTopOnRoute />
        {/* WCAG 2.4.1. Every page repeats the same header — logo, six nav
            links, search, two language buttons, theme toggle, account menu —
            so a keyboard or screen-reader user tabbed through a dozen
            controls before reaching the content on every navigation. First
            focusable thing in the app, visible only while focused. */}
        <a href="#main" className="skip-link">
          {language === 'en' ? 'Skip to content' : 'Sari la conținut'}
        </a>
        <PaperOverlay />
        {user && !isEmailVerified && !hideAppChrome && (
          <div className="no-print bg-accent text-[color:var(--ink)] py-2 px-4 flex items-center justify-center gap-4 text-sm font-display italic shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                {language === 'en'
                  ? "Your email is not verified. Some features may be restricted."
                  : "Email-ul tău nu este verificat. Unele funcționalități pot fi restricționate."}
              </span>
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-[color:var(--ink)] underline p-0 h-auto font-bold uppercase tracking-wider text-xs"
              onClick={handleResendVerification}
              disabled={isVerifying}
            >
              {isVerifying
                ? (language === 'en' ? "Sending..." : "Se trimite...")
                : (language === 'en' ? "Resend Link" : "Retrimite Link-ul")}
            </Button>
          </div>
        )}
        {/* The chrome sits OUTSIDE the route boundary below, so until now a
            render error in the navbar or footer propagated to the root and
            React unmounted the whole app — a blank page rather than a broken
            header. Each gets its own boundary so a failure there costs only
            that strip.

            The navbar's fallback is not `null`: without it a reader on an
            article page has no way back except the browser button. A logo
            linking home is the minimum that keeps the site usable. */}
        {!hideAppChrome && (
          <ErrorBoundary
            fallback={
              <header className="ed-nav">
                <div className="ed-container flex items-center" style={{ paddingTop: 16, paddingBottom: 14, minHeight: 80 }}>
                  <Link to="/" className="flex items-center gap-3">
                    <picture>
                      <source type="image/webp" srcSet="/logo.webp" />
                      <img src="/logo.png" alt="The RoStory" width={42} height={42} className="h-[42px] w-[42px] object-contain" />
                    </picture>
                    <span className="font-display italic font-semibold text-[23px]" style={{ color: 'var(--gold)' }}>
                      The RoStory
                    </span>
                  </Link>
                </div>
              </header>
            }
          >
            <Navbar />
          </ErrorBoundary>
        )}
        <main id="main" tabIndex={-1} className="flex-1">
          <ErrorBoundary
            fallback={
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <p className="text-lg font-serif text-muted-foreground">
                {language === 'en'
                  ? 'Something went wrong loading this page.'
                  : 'A apărut o problemă la încărcarea acestei pagini.'}
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                {language === 'en' ? 'Reload' : 'Reîncarcă'}
              </Button>
            </div>
          }
          >
          <Suspense fallback={
            <div className="flex justify-center p-20">
              <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<Auth />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/category/:id" element={<CategoryDetail />} />
              <Route path="/support" element={<Support />} />
              <Route path="/my-story" element={<MyStory />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/article/:id" element={<ArticleDetail />} />
              <Route
                path="/admin/video-story/create"
                element={canAccessAdmin ? <VideoStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/video-story/edit/:id"
                element={canAccessAdmin ? <VideoStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/carousel-story/create"
                element={canAccessAdmin ? <CarouselStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/carousel-story/edit/:id"
                element={canAccessAdmin ? <CarouselStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/text-story/create"
                element={canAccessAdmin ? <TextStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/text-story/edit/:id"
                element={canAccessAdmin ? <TextStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/*"
                element={canAccessAdmin ? <AdminDashboard /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
        {!hideAppChrome && (
          <ErrorBoundary fallback={null}>
            <StorybookFooter language={language} />
          </ErrorBoundary>
        )}
        <ScrollToTop />
      </div>
    </ThemedProvider>
  );
};

export default App;
