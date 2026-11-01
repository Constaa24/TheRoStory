import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useNavigate, useSearchParams, useLocation, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHead } from "@/components/layout/PageHead";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { ReducedMotionConfig } from "@/components/ui/reduced-motion-config";
import { Rosette, Thread } from "@/components/story/Ornaments";

const GoogleIcon: React.FC = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// The storybook's button voices, applied over the shadcn Button's defaults
// (cn merges them, so these win over the variant classes).
const PRIMARY = "w-full rounded-full h-12 font-ui font-semibold text-[15px] bg-[color:var(--gold)] text-[color:var(--on-gold)] hover:bg-[color:var(--gold-2)]";
const GHOST = "w-full rounded-full h-12 font-ui font-semibold text-[15px] border border-[color:var(--line)] bg-transparent text-[color:var(--parchment)] hover:bg-[color:var(--glow)] hover:text-[color:var(--parchment)]";
const QUIET = "w-full rounded-full h-11 font-display italic text-[19px] text-[color:var(--gold)] hover:bg-transparent hover:text-[color:var(--gold-2)]";
const CARD = "border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-none rounded-[26px]";
const INPUT = "h-[50px] rounded-xl bg-[color:var(--ink-2)] border-[color:var(--line)] text-[16px]";

/** Every view of this page: the reading room in an arch, beside the card. */
const AuthFrame: React.FC<{ language: "en" | "ro"; children: React.ReactNode }> = ({ language, children }) => (
  <div className="ed-container" style={{ paddingTop: "clamp(40px, 6vw, 64px)", paddingBottom: "clamp(64px, 8vw, 96px)" }}>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[70vh]">
      <figure className="m-0 w-full max-w-[520px] justify-self-center hidden lg:block">
        <div className="sb-window">
          <div className="sb-arch" style={{ aspectRatio: "4 / 4.6" }}>
            <picture>
              <source type="image/avif" srcSet="/bucharest_reading_room.avif" />
              <source type="image/webp" srcSet="/bucharest_reading_room.webp" />
              <img src="/bucharest_reading_room.jpg" alt="" width={1024} height={1024} decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            </picture>
          </div>
        </div>
        <figcaption className="sb-kicker-sm text-center mt-4" style={{ color: "var(--text-dim)" }}>
          {language === "en"
            ? "Save the stories you love, and leave notes for other readers."
            : "Păstrează poveștile dragi și lasă note pentru alți cititori."}
        </figcaption>
      </figure>
      <div className="w-full flex justify-center lg:justify-start">{children}</div>
    </div>
  </div>
);

const Auth: React.FC = () => {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    confirmPasswordReset,
    sendVerification,
    user,
    isRecoveryMode,
    exitRecoveryMode,
  } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isResetPasswordPath = location.pathname === "/reset-password";
  const isResetMode = searchParams.get("mode") === "reset";

  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  // Tracks whether the verification screen was reached because login was
  // attempted on an unconfirmed account, vs. a fresh signup. Affects the
  // copy on the screen but the resend action is the same.
  const [verificationReason, setVerificationReason] = useState<"signup" | "unconfirmed-login">("signup");
  const [isResending, setIsResending] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [view, setView] = useState<"auth" | "forgot-password" | "reset-password">(
    (isResetPasswordPath || isResetMode) ? "reset-password" : "auth"
  );

  // Keep tab/view in sync when the URL changes mid-mount (e.g. user clicks a
  // /auth?mode=signup link from elsewhere in the app while Auth is already
  // mounted). Without this the page would silently keep its initial tab.
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") setActiveTab("signup");
    else if (mode === "login") setActiveTab("login");
  }, [searchParams]);

  useEffect(() => {
    if (isResetPasswordPath || isResetMode) setView("reset-password");
  }, [isResetPasswordPath, isResetMode]);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  // One toggle per field — sharing a single boolean across login/signup
  // would reveal both fields at once even if only one is on screen.
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const leaveRecoveryMode = async (nextPath: string = "/auth") => {
    if (isRecoveryMode) {
      await exitRecoveryMode({ signOut: true });
    }
    navigate(nextPath, { replace: true, state: { bypassRecoveryRedirect: true } });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result?.error) throw result.error;
      toast.success(t("auth.welcomeBack"));
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Supabase rejects sign-in on unconfirmed accounts with this error.
      // Surface a recovery path instead of just a dead-end toast.
      const lower = message.toLowerCase();
      if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
        setVerificationReason("unconfirmed-login");
        setIsVerificationSent(true);
        return;
      }
      // Map to our own copy instead of surfacing the raw Supabase message,
      // which can leak internals (rate-limit values, account state).
      toast.error(
        lower.includes("invalid login credentials")
          ? t("auth.invalidCredentials")
          : t("auth.loginFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }
    setIsLoading(true);
    try {
      const result = await signUp({ email: email.trim(), password, displayName });

      // Treat the "User already registered" error path the same as a fresh
      // signup that needs email verification — Supabase otherwise returns a
      // distinguishing message that lets a stranger probe whether an email
      // is registered. Always show the verification screen and let the
      // confirmation email do the real disambiguation.
      if (result?.error) {
        const message = (result.error.message || '').toLowerCase();
        if (message.includes('registered') || message.includes('exists') || message.includes('already')) {
          setVerificationReason("signup");
          setIsVerificationSent(true);
          toast.success(t("auth.signupGeneric"));
          return;
        }
        throw result.error;
      }

      // Email confirmation needed: user exists but no session yet.
      if (result?.data?.user && !result?.data?.session) {
        setVerificationReason("signup");
        setIsVerificationSent(true);
        toast.success(t("auth.accountCreatedVerify"));
      } else {
        // Autoconfirm is on — user is immediately signed in
        toast.success(t("auth.accountCreatedWelcome"));
        navigate("/");
      }
    } catch {
      // Don't surface the underlying error message — generic toast only,
      // to avoid leaking whether the email exists.
      toast.error(t("auth.signupFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // Supabase's rate-limit errors carry exact timings ("you can only request
  // this after 47 seconds"), which both leaks backend policy and reads badly.
  // handleSignIn/handleSignUp already map provider errors to our own copy;
  // these helpers extend the same treatment to the remaining flows.
  const isRateLimitError = (error: unknown): boolean => {
    const message = (error instanceof Error ? error.message : "").toLowerCase();
    return (
      message.includes("security purposes") ||
      message.includes("rate limit") ||
      message.includes("too many")
    );
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.error) throw result.error;
      // OAuth redirects immediately on success. No success toast needed here.
    } catch (error) {
      toast.error(isRateLimitError(error) ? t("auth.rateLimited") : t("auth.googleFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await sendPasswordReset(email.trim());
      if (result?.error) throw result.error;
      toast.success(t("auth.resetLinkSent"));
      setView("auth");
    } catch (error) {
      // Never surface the raw message here: Supabase returns success for
      // unknown addresses by design (so this endpoint can't be used to probe
      // who has an account), and echoing its errors would undo that.
      toast.error(isRateLimitError(error) ? t("auth.rateLimited") : t("auth.resetLinkFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }
    setIsLoading(true);
    try {
      // When coming from the callback, user already has a valid session
      // from the magic link — we can directly update the password
      const result = await confirmPasswordReset(newPassword);
      if (result?.error) throw result.error;
      await exitRecoveryMode({ signOut: true });
      toast.success(t("auth.passwordUpdated"));
      setView("auth");
      setActiveTab("login");
      navigate("/auth", { replace: true, state: { bypassRecoveryRedirect: true } });
    } catch (error) {
      // Map the two cases worth explaining. In particular Supabase's own
      // length error quotes its server-side minimum, which can contradict
      // the 8-character rule this form enforces.
      const raw = (error instanceof Error ? error.message : "").toLowerCase();
      if (raw.includes("different from the old password") || raw.includes("should be different")) {
        toast.error(t("auth.passwordSameAsOld"));
      } else if (raw.includes("password") && raw.includes("characters")) {
        toast.error(t("auth.passwordTooShort"));
      } else {
        toast.error(isRateLimitError(error) ? t("auth.rateLimited") : t("auth.passwordResetFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Rendered in every branch below — without it these routes have no
  // <title> at all (the static index.html fallback is stripped at boot).
  // noindex: robots.txt already disallows /auth, this is belt-and-suspenders.
  const pageHead = (
    <PageHead
      title={view === "reset-password" ? t("auth.resetPassword") : t("auth.loginTab")}
      description={t("auth.continueJourney")}
      language={language}
    >
      <meta name="robots" content="noindex, nofollow" />
    </PageHead>
  );

  // Already signed in and not in a recovery/verification flow — the
  // login/signup forms are meaningless, so send the user home. (Recovery
  // sessions render the reset-password view, which must stay reachable.)
  if (user && view === "auth" && !isVerificationSent && !isRecoveryMode) {
    return <Navigate to="/" replace />;
  }

  if (isVerificationSent) {
    const handleResend = async () => {
      const target = email.trim();
      if (!target) return;
      setIsResending(true);
      try {
        const result = await sendVerification(target);
        if (result && 'error' in result && result.error) throw result.error;
        toast.success(t("auth.resendVerificationSuccess"));
      } catch {
        // Don't surface the underlying message — Supabase's resend errors
        // can leak details (rate-limit values, account state). A generic
        // failure toast is enough.
        toast.error(t("auth.resendVerificationFailed"));
      } finally {
        setIsResending(false);
      }
    };

    const isUnconfirmedLogin = verificationReason === "unconfirmed-login";

    return (
      <AuthFrame language={language}>
        {pageHead}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className={`${CARD} text-center`}>
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--line)", color: "var(--gold)" }}>
                  <Mail className="h-8 w-8" />
                </div>
              </div>
              <h1 className="sb-h3" style={{ fontSize: 34 }}>
                {isUnconfirmedLogin ? t("auth.emailNotConfirmedTitle") : t("auth.checkEmail")}
              </h1>
              <CardDescription className="font-display italic text-[19px] text-[color:var(--text-dim)]">
                {isUnconfirmedLogin
                  ? t("auth.emailNotConfirmedDesc")
                  : `${t("auth.verificationSentTo")} ${email}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground italic">
                {t("auth.didntGetEmail")}
              </p>
              <Button
                type="button"
                className={PRIMARY}
                onClick={handleResend}
                disabled={isResending || !email.trim()}
              >
                {isResending ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  t("auth.resendVerification")
                )}
              </Button>
              <Button
                variant="outline"
                type="button"
                className={GHOST}
                onClick={() => navigate("/")}
              >
                {t("auth.goHome")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </AuthFrame>
    );
  }

  if (view === "forgot-password") {
    return (
      <AuthFrame language={language}>
        {pageHead}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className={`${CARD}`}>
            <CardHeader className="text-center">
              <h1 className="sb-h3" style={{ fontSize: 34 }}>
                {t("auth.resetPassword")}
              </h1>
              <CardDescription className="font-display italic text-[19px] text-[color:var(--text-dim)]">
                {t("auth.resetPasswordDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="sb-label" htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="email@example.com"
                      className={`pl-10 ${INPUT}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={254}
                    />
                  </div>
                </div>
                <Button type="submit" className={PRIMARY} disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.sendLink")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={QUIET}
                  onClick={() => setView("auth")}
                >
                  {t("auth.backToLogin")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </AuthFrame>
    );
  }

  if (view === "reset-password") {
    // If user has no session and not coming from reset mode, show error state
    if (!isResetMode && !user) {
      return (
        <AuthFrame language={language}>
        {pageHead}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <Card className={`${CARD}`}>
              <CardHeader className="text-center">
                <h1 className="sb-h3" style={{ fontSize: 34 }}>
                  {t("auth.invalidResetLink")}
                </h1>
                <CardDescription className="font-display italic text-[19px] text-[color:var(--text-dim)]">
                  {t("auth.invalidResetLinkDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t("auth.invalidResetLinkHelp")}
                </p>
                <Button
                  className={PRIMARY}
                  onClick={async () => {
                    setView("forgot-password");
                    await leaveRecoveryMode("/auth");
                  }}
                >
                  {t("auth.requestNewLink")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={QUIET}
                  onClick={async () => {
                    setView("auth");
                    await leaveRecoveryMode("/auth");
                  }}
                >
                  {t("auth.backToLogin")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </AuthFrame>
      );
    }

    return (
      <AuthFrame language={language}>
        {pageHead}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className={`${CARD}`}>
            <CardHeader className="text-center">
              <h1 className="sb-h3" style={{ fontSize: 34 }}>
                {t("auth.newPassword")}
              </h1>
              <CardDescription className="font-display italic text-[19px] text-[color:var(--text-dim)]">
                {t("auth.newPasswordDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="sb-label" htmlFor="new-password">{t("auth.newPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <Input
                      id="new-password"
                      type={showNewPwd ? "text" : "password"}
                      className={`pl-10 pr-11 ${INPUT}`}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={72}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(s => !s)}
                      aria-label={showNewPwd ? t("auth.hidePassword") : t("auth.showPassword")}
                      aria-pressed={showNewPwd}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-[color:var(--gold)] transition-colors"
                    >
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className={PRIMARY} disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.resetPassword")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={QUIET}
                  onClick={async () => {
                    setView("auth");
                    await leaveRecoveryMode("/auth");
                  }}
                >
                  {t("auth.cancel")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame language={language}>
      {pageHead}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className={`${CARD}`}>
          <CardHeader className="gap-2">
            <Rosette size="sm" />
            <h1 className="sb-h2" style={{ fontSize: "clamp(32px, 3.4vw, 44px)" }}>
              {activeTab === "login" ? t("auth.continueJourney") : t("auth.startStory")}
            </h1>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 rounded-full p-1 h-12 bg-transparent border border-[color:var(--line)]">
                <TabsTrigger value="login" className="rounded-full font-ui font-semibold text-[14px] data-[state=active]:bg-[color:var(--gold)] data-[state=active]:text-[color:var(--on-gold)]">{t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full font-ui font-semibold text-[14px] data-[state=active]:bg-[color:var(--gold)] data-[state=active]:text-[color:var(--on-gold)]">{t("auth.signupTab")}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="sb-label" htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@example.com"
                        className={`pl-10 ${INPUT}`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        maxLength={254}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="sb-label" htmlFor="password">{t("auth.password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                      <Input
                        id="password"
                        type={showLoginPwd ? "text" : "password"}
                        className={`pl-10 pr-11 ${INPUT}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        maxLength={72}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPwd(s => !s)}
                        aria-label={showLoginPwd ? t("auth.hidePassword") : t("auth.showPassword")}
                        aria-pressed={showLoginPwd}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-[color:var(--gold)] transition-colors"
                      >
                        {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      variant="link" 
                      className="px-0 h-auto font-display italic text-[16px] text-[color:var(--gold)] underline underline-offset-4"
                      onClick={() => setView("forgot-password")}
                      type="button"
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  <Button type="submit" className={PRIMARY} disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.loginTab")}
                  </Button>
                  
                  <div className="flex items-center gap-3 my-4">
                    <Thread className="flex-1" />
                    <span className="sb-meta">{t("auth.orContinueWith")}</span>
                    <Thread className="flex-1" />
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className={GHOST}
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <GoogleIcon />
                      {language === "en" ? "Continue with Google" : "Continuă cu Google"}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="sb-label" htmlFor="name">{t("auth.displayName")}</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                      <Input
                        id="name"
                        placeholder="Ion Popescu"
                        className={`pl-10 ${INPUT}`}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="sb-label" htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="email@example.com"
                        className={`pl-10 ${INPUT}`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        maxLength={254}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="sb-label" htmlFor="signup-password">{t("auth.password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                      <Input
                        id="signup-password"
                        type={showSignupPwd ? "text" : "password"}
                        className={`pl-10 pr-11 ${INPUT}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        maxLength={72}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPwd(s => !s)}
                        aria-label={showSignupPwd ? t("auth.hidePassword") : t("auth.showPassword")}
                        aria-pressed={showSignupPwd}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-[color:var(--gold)] transition-colors"
                      >
                        {showSignupPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className={PRIMARY} disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.createAccount")}
                  </Button>
                  
                  <div className="flex items-center gap-3 my-4">
                    <Thread className="flex-1" />
                    <span className="sb-meta">{t("auth.orContinueWith")}</span>
                    <Thread className="flex-1" />
                  </div>
                  
                  <div className="flex justify-center">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className={GHOST} 
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <GoogleIcon />
                      {language === "en" ? "Continue with Google" : "Continuă cu Google"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col justify-center py-4 relative border-t-0">
            <Thread className="absolute top-0 left-8 right-8" style={{ opacity: 0.3 }} />
            <p className="sb-meta text-center px-4">
              {t("auth.agreement")}
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </AuthFrame>
  );
};

// Wrapped at the export so framer-motion's reduced-motion handling travels
// with this lazy chunk instead of the app entry point. See
// components/ui/reduced-motion-config.tsx.
const AuthPage: React.FC = () => (
  <ReducedMotionConfig>
    <Auth />
  </ReducedMotionConfig>
);

export default AuthPage;
