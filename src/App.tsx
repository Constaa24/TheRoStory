import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import ScrollToTopOnRoute from "@/components/ui/ScrollToTopOnRoute";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { AlertCircle } from "lucide-react";
import { PaperOverlay } from "@/components/ui/PaperOverlay";
import { SocialLinks } from "@/components/ui/social-links";
import { Divider, Motif, Rosette, StoryLoading } from "@/components/story/Ornaments";
import { toast } from "sonner";
import { fetchCategories, fetchRandomArticle, Category } from "@/lib/supabase";
import { ErrorBoundary, isChunkLoadError } from "@/components/ui/ErrorBoundary";

// After a deploy, content-hashed chunk filenames change and the old ones are
// removed from the server. A tab still running the previous build (browser or
// service-worker cache) then requests a chunk that 404s (vercel.json keeps
// /assets/ out of the SPA rewrite, so it is a real 404 rather than index.html
// with a 200, which the service worker would have cached as the chunk) and
// the dynamic import fails. lazyWithReload catches that specific "stale chunk"
// failure once and reloads the page so the browser pulls the fresh index.html
// + current chunks, instead of crashing into the error boundary. A
// sessionStorage flag prevents a reload loop if the failure is real (e.g. an
// actually-broken deploy) rather than a stale-asset mismatch.
//
// Before reloading it asks the service worker for the new build: the stale
// tab is often running the old worker's precache, and reloading straight away
// was answered by that same old build, so the reload failed the same way and
// fell through to "Something went wrong". The new worker skips waiting and
// claims the page (registerType 'autoUpdate'), so waiting for it to activate,
// up to a few seconds, is enough.
const takeNewServiceWorker = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return;
    await registration.update();
    const incoming = registration.installing || registration.waiting;
    if (!incoming) return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 4000);
      incoming.addEventListener("statechange", () => {
        if (incoming.state === "activated" || incoming.state === "redundant") {
          window.clearTimeout(timer);
          resolve();
        }
      });
    });
  } catch {
    /* no service worker, or offline: reload anyway */
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (isChunkLoadError(error)) {
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
            await takeNewServiceWorker();
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
 * The foot of every page (the redesign's RoStory shell): who we are, the
 * shelves, places to go next, the fine print, and a line about why stories
 * matter.
 */
function StorybookFooter({ language }: { language: 'en' | 'ro' }) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const en = language === 'en';

  React.useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const randomStory = async () => {
    const a = await fetchRandomArticle().catch(() => null);
    if (a) navigate(`/article/${a.id}`, { state: { from: `${location.pathname}${location.search}` } });
  };

  const column = (label: string, items: React.ReactNode[]) => (
    <nav aria-label={label} className="flex flex-col gap-3.5">
      <p className="rs-kicker">{label}</p>
      {items}
    </nav>
  );

  // mt-14 on phones: every page already ends on its own bottom padding
  // (64 px and up), and a fixed gap on top of that left ~200 px of empty
  // screen before the footer.
  return (
    <footer className="no-print mt-14 md:mt-[120px]" style={{ background: 'var(--ink-2)' }}>
      {/* A band of cross-stitch opens the footer. */}
      <Motif style={{ opacity: 0.32 }} />
      <div className="ed-container" style={{ paddingTop: 'clamp(48px, 6vw, 80px)' }}>
        <div className="grid items-start gap-x-10 gap-y-12 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          <div className="flex flex-col gap-5 max-w-[420px] min-[1000px]:col-span-2">
            <Link to="/" className="flex items-center gap-3 self-start" aria-label={en ? 'The RoStory, home' : 'The RoStory, acasă'}>
              <picture>
                <source type="image/webp" srcSet="/logo-128.webp" />
                <img src="/logo-128.png" alt="" width={52} height={52} className="h-[52px] w-[52px] object-contain" />
              </picture>
              <span className="rs-wordmark" style={{ fontSize: 30 }}>The RoStory</span>
            </Link>
            <p className="m-0 text-[16px] leading-[1.6]" style={{ color: 'var(--text-dim)', textWrap: 'pretty' }}>
              {en
                ? 'A reader-supported visual archive of the histories, traditions, landscapes and people of Romania. Published from Bucharest.'
                : 'O arhivă vizuală susținută de cititori cu istoriile, tradițiile, peisajele și oamenii României. Publicată din București.'}
            </p>
            <SocialLinks iconSize="sb-ico" className="gap-2.5" linkClassName="sb-icon-btn" />
          </div>
          {column(en ? 'The shelves' : 'Rafturile', categories.map((cat) => (
            <Link key={cat.id} to={`/category/${cat.id}`} className="rs-foot-link">{en ? cat.nameEn : cat.nameRo}</Link>
          )))}
          {column(en ? 'Explore' : 'Explorează', [
            <Link key="map" to="/map" className="rs-foot-link">{en ? 'The Atlas' : 'Atlasul'}</Link>,
            <Link key="shelves" to="/categories" className="rs-foot-link">{en ? 'All shelves' : 'Toate rafturile'}</Link>,
            <button key="random" type="button" onClick={randomStory} className="rs-foot-link text-left p-0 border-0 bg-transparent cursor-pointer" style={{ fontFamily: 'inherit' }}>
              {en ? 'A story at random' : 'O poveste la întâmplare'}
            </button>,
            <Link key="about" to="/my-story" className="rs-foot-link">{en ? 'My Story' : 'Povestea mea'}</Link>,
            <Link key="support" to="/support" className="rs-foot-link">{en ? 'Support the archive' : 'Susține arhiva'}</Link>,
          ])}
          {column(en ? 'The fine print' : 'Detalii', [
            <Link key="privacy" to="/privacy" className="rs-foot-link">{en ? 'Privacy policy' : 'Politica de confidențialitate'}</Link>,
            <Link key="terms" to="/terms" className="rs-foot-link">{en ? 'Terms' : 'Termeni'}</Link>,
            <Link key="cookies" to="/privacy#cookies" className="rs-foot-link">{en ? 'Cookies' : 'Cookie-uri'}</Link>,
            <Link key="contact" to="/contact-us" className="rs-foot-link">Contact</Link>,
          ])}
        </div>
        <Divider style={{ marginTop: 'clamp(48px, 6vw, 72px)' }} />
        {/* Extra room at the bottom on a phone, so the last line can scroll
            out from under the floating back-to-top button. */}
        <div className="flex flex-wrap justify-between items-start gap-x-10 gap-y-5 pb-24 sm:pb-10" style={{ paddingTop: 26 }}>
          <div className="flex flex-col gap-1.5" style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-mute)' }}>
            <p className="m-0">
              © {new Date().getFullYear()} The RoStory · {en ? 'Made in Bucharest, with field notes from everywhere.' : 'Făcut în București, cu note de teren de pretutindeni.'}
            </p>
            {/* Site-wide AI disclosure; each story also says it beside its
                title. See aiPhrase in EditorialArticle. */}
            <p className="m-0">
              {en ? 'Every picture and film here is made with AI: ' : 'Toate imaginile și filmele de aici sunt realizate cu AI: '}
              <Link to="/terms#pictures" className="rs-underline">{en ? 'illustrations, not photographs' : 'ilustrații, nu fotografii'}</Link>.
            </p>
          </div>
          <p className="font-display italic m-0 max-w-[560px] text-[19px] leading-[1.45]" style={{ color: 'var(--text-dim)' }}>
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
        <div
          className="no-print py-2.5 px-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center"
          style={{ background: 'var(--paper)', borderBottom: '1px dashed var(--gold-deep)' }}
        >
          <div className="flex items-center gap-2 font-display italic text-[17px]" style={{ color: 'var(--parchment)' }}>
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--gold)' }} aria-hidden="true" />
            <span>
              {language === 'en'
                ? "Your email is not verified. Some features may be restricted."
                : "Email-ul tău nu este verificat. Unele funcționalități pot fi restricționate."}
            </span>
          </div>
          <button
            type="button"
            className="rs-underline"
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 700 }}
            onClick={handleResendVerification}
            disabled={isVerifying}
          >
            {isVerifying
              ? (language === 'en' ? "Sending…" : "Se trimite…")
              : (language === 'en' ? "Send the link again" : "Retrimite linkul")}
          </button>
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
              <div className="ed-container flex items-center" style={{ height: 72 }}>
                <Link to="/" className="flex items-center gap-3" aria-label={language === 'en' ? 'The RoStory, home' : 'The RoStory, acasă'}>
                  <picture>
                    <source type="image/webp" srcSet="/logo-128.webp" />
                    <img src="/logo-128.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
                  </picture>
                  <span className="rs-wordmark">The RoStory</span>
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
          resetKey={location.pathname}
          fallback={(error) => {
            const stale = isChunkLoadError(error);
            return (
              <div className="flex flex-col items-center justify-center text-center px-6 py-20 gap-5">
                <Rosette size="lg" />
                <p className="font-display italic m-0 max-w-[460px]" style={{ fontSize: 24, lineHeight: 1.35, color: 'var(--parchment)' }}>
                  {stale
                    ? (language === 'en' ? 'The site has been updated since this page opened.' : 'Site-ul a fost actualizat de când ai deschis pagina.')
                    : (language === 'en' ? 'Something went wrong loading this page.' : 'A apărut o problemă la încărcarea acestei pagini.')}
                </p>
                <button
                  type="button"
                  className="sb-btn sb-btn-ghost"
                  onClick={async () => { await takeNewServiceWorker(); window.location.reload(); }}
                >
                  {language === 'en' ? 'Reload the page' : 'Reîncarcă pagina'}
                </button>
                {/* The error itself, small: a screenshot of this screen is
                    then enough to say what broke. */}
                <p className="sb-meta m-0 max-w-[460px] break-words" style={{ fontSize: 12, opacity: 0.75 }}>
                  {`${error.name}: ${error.message}`.slice(0, 220)}
                </p>
              </div>
            );
          }}
        >
        {/* A full screen tall: with only a small loader in <main>, the
            footer rendered near the top of the screen until the page's
            code arrived, then jumped out of view — a layout shift of up to
            0.49 on every navigation at desktop sizes (0.1 is "poor"). */}
        <Suspense fallback={<StoryLoading language={language} className="items-center" style={{ minHeight: '100vh' }} />}>
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
  );
};

export default App;
