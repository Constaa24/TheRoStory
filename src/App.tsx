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

// Lazy load pages for better performance
const Home = lazy(() => import("@/pages/Home"));
const MapPage = lazy(() => import("@/pages/Map"));
const Auth = lazy(() => import("@/pages/Auth"));
const ArticleDetail = lazy(() => import("@/pages/ArticleDetail"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const VideoStoryCreate = lazy(() => import("@/pages/VideoStoryCreate"));
const CarouselStoryCreate = lazy(() => import("@/pages/CarouselStoryCreate"));
const TextStoryCreate = lazy(() => import("@/pages/TextStoryCreate"));
const Categories = lazy(() => import("@/pages/Categories"));
const CategoryDetail = lazy(() => import("@/pages/CategoryDetail"));
const Support = lazy(() => import("@/pages/Support"));
const MyStory = lazy(() => import("@/pages/MyStory"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const Profile = lazy(() => import("@/pages/Profile"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const NewsletterConfirm = lazy(() => import("@/pages/NewsletterConfirm"));

type FooterItem = { label: string; href: string };

function FooterCol({ title, items }: { title: string; items: FooterItem[] }) {
  const columns = [];
  for (let i = 0; i < items.length; i += 5) {
    columns.push(items.slice(i, i + 5));
  }

  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      <div className="flex flex-wrap gap-x-12 gap-y-6">
        {columns.map((col, idx) => (
          <ul key={idx} className="list-none p-0 m-0 flex flex-col gap-3 min-w-[120px]">
            {col.map(i => (
              <li key={i.label}>
                <Link to={i.href} className="text-ink-dim hover:text-gold text-[15px] transition-colors">{i.label}</Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

function EditorialFooter({ language }: { language: 'en' | 'ro' }) {
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const archiveItems: FooterItem[] = categories.map(cat => ({
    label: language === 'en' ? cat.nameEn : cat.nameRo,
    href: `/category/${cat.id}`,
  }));

  return (
    <footer className="mt-32 pt-20 pb-10 border-t border-line bg-[color:var(--ink-2)]/30">
      <div className="ed-container">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-14 items-start">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <picture>
                <source type="image/webp" srcSet="/logo.webp" />
                <img src="/logo.png" alt="The RoStory" width={48} height={48} className="h-12 w-12 object-contain" />
              </picture>
              <span
                className="font-display italic font-semibold text-[26px] leading-none"
                style={{
                  background: 'var(--logo-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.01em',
                }}
              >
                The RoStory
              </span>
            </Link>
            <p className="text-ink-dim mt-6 max-w-[360px] text-base leading-relaxed">
              {language === 'en'
                ? 'A reader-supported visual archive of the histories, traditions, landscapes and people of Romania. Published from Bucharest.'
                : 'O arhivă vizuală susținută de cititori cu istoriile, tradițiile, peisajele și oamenii României. Publicată din București.'}
            </p>
            <div className="mt-7">
              <SocialLinks />
            </div>
          </div>
          <FooterCol title={language === 'en' ? 'Archive' : 'Arhivă'} items={archiveItems} />
          <div>
            <div className="eyebrow mb-4">{language === 'en' ? 'The fine print' : 'Detalii'}</div>
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              <li><Link to="/privacy" className="text-ink-dim hover:text-gold text-[15px] transition-colors">{language === 'en' ? 'Privacy policy' : 'Confidențialitate'}</Link></li>
              <li><Link to="/terms" className="text-ink-dim hover:text-gold text-[15px] transition-colors">{language === 'en' ? 'Terms' : 'Termeni'}</Link></li>
              <li><Link to="/contact-us" className="text-ink-dim hover:text-gold text-[15px] transition-colors">{language === 'en' ? 'Contact' : 'Contact'}</Link></li>
            </ul>
          </div>
        </div>
        <div className="rule my-14" />
        <div className="flex flex-wrap justify-between gap-4 font-ui text-xs text-ink-mute tracking-[0.1em]">
          <span>© {new Date().getFullYear()} The RoStory · {language === 'en' ? 'Made in Bucharest, with field notes from everywhere.' : 'Făcut în București, cu note de teren de pretutindeni.'}</span>
          <span className="font-display italic text-base text-ink-dim max-w-md">
            {language === 'en'
              ? '"Storytelling is the essential human activity. The harder the situation, the more essential it is."'
              : '„Povestirea este activitatea umană esențială. Cu cât situația este mai grea, cu atât devine mai esențială."'}
          </span>
        </div>
      </div>
    </footer>
  );
};

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
        <div className="animate-pulse text-2xl font-serif text-accent tracking-[0.2em] italic px-2 pb-1">The RoStory...</div>
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
        <PaperOverlay />
        {user && !isEmailVerified && !hideAppChrome && (
          <div className="bg-accent text-[color:var(--ink)] py-2 px-4 flex items-center justify-center gap-4 text-sm font-display italic shadow-md">
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
        {!hideAppChrome && <Navbar />}
        <main className="flex-1">
          <ErrorBoundary
            fallback={
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <p className="text-lg font-serif text-muted-foreground">Something went wrong loading this page.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
        {!hideAppChrome && <EditorialFooter language={language} />}
        <ScrollToTop />
      </div>
    </ThemedProvider>
  );
};

export default App;
