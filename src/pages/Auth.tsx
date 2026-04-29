import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { motion } from "framer-motion";

const GoogleIcon: React.FC = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Auth: React.FC = () => {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    confirmPasswordReset,
    user,
    isRecoveryMode,
    exitRecoveryMode,
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isResetPasswordPath = location.pathname === "/reset-password";
  const isResetMode = searchParams.get("mode") === "reset";

  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
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
    } catch (error: any) {
      toast.error(error.message || t("auth.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await signUp({ email: email.trim(), password, displayName });
      if (result?.error) throw result.error;
      
      // Check if email confirmation is needed
      // When autoconfirm is off, user object exists but session is null
      if (result?.data?.user && !result?.data?.session) {
        // Email confirmation required — show verification screen
        setIsVerificationSent(true);
        toast.success(t("auth.accountCreatedVerify"));
      } else {
        // Autoconfirm is on — user is immediately signed in
        toast.success(t("auth.accountCreatedWelcome"));
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || t("auth.signupFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.error) throw result.error;
      // OAuth redirects immediately on success. No success toast needed here.
    } catch (error: any) {
      toast.error(error.message || t("auth.googleFailed"));
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
    } catch (error: any) {
      toast.error(error.message || t("auth.resetLinkFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (error: any) {
      toast.error(error.message || t("auth.passwordResetFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerificationSent) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center items-center min-h-[70vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-border/40 bg-secondary/20 backdrop-blur-md text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                  <Mail className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-3xl font-serif italic text-primary">
                {t("auth.checkEmail")}
              </CardTitle>
              <CardDescription className="text-muted-foreground font-serif italic text-lg">
                {`${t("auth.verificationSentTo")} ${email}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-6">
                {t("auth.verifyEmailPrompt")}
              </p>
              <Button
                variant="outline"
                className="w-full rounded-full h-12 font-serif italic"
                onClick={() => navigate("/")}
              >
                {t("auth.goHome")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (view === "forgot-password") {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center items-center min-h-[80vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-border/40 bg-secondary/20 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-serif italic text-primary">
                {t("auth.resetPassword")}
              </CardTitle>
              <CardDescription className="text-muted-foreground font-serif italic">
                {t("auth.resetPasswordDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="reset-email" 
                      type="email" 
                      placeholder="email@example.com" 
                      className="pl-10 bg-background/50" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-full h-12 text-lg font-serif italic" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.sendLink")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-full font-serif italic"
                  onClick={() => setView("auth")}
                >
                  {t("auth.backToLogin")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (view === "reset-password") {
    // If user has no session and not coming from reset mode, show error state
    if (!isResetMode && !user) {
      return (
        <div className="container mx-auto px-4 py-20 flex justify-center items-center min-h-[80vh]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <Card className="border-border/40 bg-secondary/20 backdrop-blur-md shadow-2xl">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-serif italic text-primary">
                  {t("auth.invalidResetLink")}
                </CardTitle>
                <CardDescription className="text-muted-foreground font-serif italic">
                  {t("auth.invalidResetLinkDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t("auth.invalidResetLinkHelp")}
                </p>
                <Button
                  className="w-full rounded-full h-12 text-lg font-serif italic"
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
                  className="w-full rounded-full font-serif italic"
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
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-20 flex justify-center items-center min-h-[80vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-border/40 bg-secondary/20 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-serif italic text-primary">
                {t("auth.newPassword")}
              </CardTitle>
              <CardDescription className="text-muted-foreground font-serif italic">
                {t("auth.newPasswordDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="new-password" 
                      type="password" 
                      className="pl-10 bg-background/50" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-full h-12 text-lg font-serif italic" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.resetPassword")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-full font-serif italic"
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
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20 flex justify-center items-center min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="border-border/40 bg-secondary/20 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-serif italic font-bold text-primary px-2 pb-1">The RoStory</CardTitle>
            <CardDescription className="text-muted-foreground font-serif italic">
              {activeTab === "login" ? t("auth.continueJourney") : t("auth.startStory")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 rounded-full p-1 h-12 bg-accent/5 border border-accent/10">
                <TabsTrigger value="login" className="rounded-full font-serif italic">{t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full font-serif italic">{t("auth.signupTab")}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="email@example.com" 
                        className="pl-10 bg-background/50" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="password" 
                        type="password" 
                        className="pl-10 bg-background/50" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      variant="link" 
                      className="px-0 font-serif italic text-muted-foreground h-auto text-xs"
                      onClick={() => setView("forgot-password")}
                      type="button"
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  <Button type="submit" className="w-full rounded-full h-12 text-lg font-serif italic" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.loginTab")}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/30" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground font-serif italic">
                        {t("auth.orContinueWith")}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full h-11 font-serif italic w-full"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <GoogleIcon />
                      Google
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("auth.displayName")}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Ion Popescu"
                        className="pl-10 bg-background/50"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signup-email" 
                        type="email" 
                        placeholder="email@example.com" 
                        className="pl-10 bg-background/50" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("auth.password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signup-password" 
                        type="password" 
                        className="pl-10 bg-background/50" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full rounded-full h-12 text-lg font-serif italic" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : t("auth.createAccount")}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/30" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground font-serif italic">
                        {t("auth.orContinueWith")}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="rounded-full h-11 font-serif italic w-full" 
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <GoogleIcon />
                      Google
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/10 py-4">
            <p className="text-xs text-muted-foreground text-center px-4 italic font-serif">
              {t("auth.agreement")}
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
