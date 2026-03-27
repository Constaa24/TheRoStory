import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Navbar } from "@/components/layout/Navbar";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import ScrollToTopOnRoute from "@/components/ui/ScrollToTopOnRoute";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { PaperOverlay } from "@/components/ui/PaperOverlay";
import { toast } from "sonner";

class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
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
const Categories = lazy(() => import("@/pages/Categories"));
const CategoryDetail = lazy(() => import("@/pages/CategoryDetail"));
const Support = lazy(() => import("@/pages/Support"));
const MyStory = lazy(() => import("@/pages/MyStory"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const Profile = lazy(() => import("@/pages/Profile"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));

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
    <ThemeProvider attribute="class" defaultTheme="light">
      <div className="min-h-screen bg-background text-foreground flex flex-col relative">
        <ScrollToTopOnRoute />
        <PaperOverlay />
        {user && !isEmailVerified && !hideAppChrome && (
          <div className="bg-accent text-white py-2 px-4 flex items-center justify-center gap-4 text-sm font-serif italic sticky top-0 z-[60] shadow-md">
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
              className="text-white underline p-0 h-auto font-bold uppercase tracking-wider text-xs"
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
            key={location.pathname}
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
              <Route path="/profile" element={<Profile />} />
              <Route path="/article/:id" element={<ArticleDetail />} />
              <Route
                path="/admin/video-story/create"
                element={canAccessAdmin ? <VideoStoryCreate /> : <Navigate to="/" replace />}
              />
              <Route
                path="/admin/carousel-story/create"
                element={canAccessAdmin ? <CarouselStoryCreate /> : <Navigate to="/" replace />}
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
        {!hideAppChrome && (
        <footer className="py-10 border-t border-border bg-secondary/30 text-center">
          <div className="container mx-auto px-4">
            <p className="font-serif text-lg italic text-secondary-foreground/70">
              "Storytelling is the essential human activity. The harder the situation, the more essential it is."
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              © {new Date().getFullYear()} The RoStory. All rights reserved.
            </p>
          </div>
        </footer>
        )}
        <ScrollToTop />
      </div>
    </ThemeProvider>
  );
};

export default App;
