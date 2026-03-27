import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { enterRecoveryMode, exitRecoveryMode } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isEmailVerificationFlow, setIsEmailVerificationFlow] = useState(false);
  const hasHandledRef = useRef(false);
  const mountedRef = useRef(true);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const scheduleRedirect = (path: string, delayMs: number) => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          navigate(path);
        }
      }, delayMs);
    };

    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms);
          })
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    if (hasHandledRef.current) {
      return () => {
        mountedRef.current = false;
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      };
    }
    hasHandledRef.current = true;

    const handleCallback = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const flow = searchParams.get("flow");
        const type = searchParams.get("type") || hashParams.get("type");
        const isRecoveryFlow = flow === "recovery" || type === "recovery";
        const isVerificationFlow =
          flow === "verification" ||
          type === "signup" ||
          type === "email_change" ||
          type === "invite";
        const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
        const errorDescription =
          searchParams.get("error_description") ||
          hashParams.get("error_description");

        if (isRecoveryFlow && mountedRef.current) {
          setIsPasswordRecovery(true);
          setIsEmailVerificationFlow(false);
        } else if (isVerificationFlow && mountedRef.current) {
          setIsEmailVerificationFlow(true);
        }

        if (errorCode || errorDescription) {
          if (!mountedRef.current) return;
          setStatus("error");
          setErrorMessage(errorDescription || "An error occurred during verification.");
          return;
        }

        if (code) {
          const { error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            10000,
            "Session exchange"
          );
          if (!mountedRef.current) return;

          if (error) {
            setStatus("error");
            setErrorMessage(error.message);
            return;
          }

          if (isRecoveryFlow) {
            enterRecoveryMode();
            setIsPasswordRecovery(true);
            setStatus("success");
            scheduleRedirect("/reset-password?mode=reset", 1500);
            return;
          }

          void exitRecoveryMode();
          setStatus("success");
          scheduleRedirect("/", 2000);
          return;
        }

        // Some Supabase recovery links use token_hash + type=recovery instead of code.
        if (tokenHash && type) {
          const { error } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as EmailOtpType,
            }),
            10000,
            "OTP verification"
          );
          if (!mountedRef.current) return;

          if (error) {
            setStatus("error");
            setErrorMessage(error.message);
            return;
          }

          setStatus("success");
          if (isRecoveryFlow) {
            enterRecoveryMode();
            setIsPasswordRecovery(true);
            scheduleRedirect("/reset-password?mode=reset", 1500);
          } else {
            void exitRecoveryMode();
            scheduleRedirect("/", 2000);
          }
          return;
        }

        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          10000,
          "Session lookup"
        );
        if (!mountedRef.current) return;

        if (session) {
          setStatus("success");
          if (isRecoveryFlow) {
            enterRecoveryMode();
            setIsPasswordRecovery(true);
            scheduleRedirect("/reset-password?mode=reset", 1500);
          } else {
            void exitRecoveryMode();
            scheduleRedirect("/", 2000);
          }
        } else {
          setStatus("error");
          setErrorMessage(
            language === "en"
              ? "The verification link is invalid or has expired."
              : "Link-ul de verificare este invalid sau a expirat."
          );
        }
      } catch (err: any) {
        if (!mountedRef.current) return;

        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
          return;
        }

        setStatus("error");
        setErrorMessage(err.message || "An unexpected error occurred.");
      }
    };

    void handleCallback();

    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [language, navigate]);

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
              {status === "loading" && (
                <div className="h-16 w-16 bg-accent/10 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-accent animate-spin" />
                </div>
              )}
              {status === "success" && (
                <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              )}
              {status === "error" && (
                <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              )}
            </div>
            <CardTitle className="text-3xl font-serif italic text-primary">
              {status === "loading" && (isPasswordRecovery
                ? (language === "en" ? "Authenticating..." : "Se autentific\u0103...")
                : (isEmailVerificationFlow
                  ? (language === "en" ? "Verifying..." : "Se verific\u0103...")
                  : (language === "en" ? "Signing In..." : "Se autentific\u0103...")))}
              {status === "success" && !isPasswordRecovery && isEmailVerificationFlow && (language === "en" ? "Email Verified!" : "Email Verificat!")}
              {status === "success" && !isPasswordRecovery && !isEmailVerificationFlow && (language === "en" ? "Signed In" : "Autentificat")}
              {status === "success" && isPasswordRecovery && (language === "en" ? "Authenticated" : "Autentificat")}
              {status === "error" && (isPasswordRecovery || isEmailVerificationFlow
                ? (language === "en" ? "Verification Failed" : "Verificare E\u0219uat\u0103")
                : (language === "en" ? "Authentication Failed" : "Autentificare E\u0219uat\u0103"))}
            </CardTitle>
            <CardDescription className="text-muted-foreground font-serif italic text-lg">
              {status === "loading" && (isPasswordRecovery
                ? (language === "en"
                  ? "Please wait while we prepare password reset..."
                  : "Te rug\u0103m s\u0103 a\u0219tep\u021bi preg\u0103tirea reset\u0103rii parolei...")
                : (isEmailVerificationFlow
                  ? (language === "en"
                    ? "Please wait while we verify your email..."
                    : "Te rug\u0103m s\u0103 a\u0219tep\u021bi verificarea email-ului...")
                  : (language === "en"
                    ? "Please wait while we complete sign-in..."
                    : "Te rug\u0103m s\u0103 a\u0219tep\u021bi finalizarea autentific\u0103rii...")))}
              {status === "success" && !isPasswordRecovery && isEmailVerificationFlow && (language === "en" ? "Your email has been confirmed. Redirecting..." : "Email-ul t\u0103u a fost confirmat. Redirec\u021bionare...")}
              {status === "success" && !isPasswordRecovery && !isEmailVerificationFlow && (language === "en" ? "Authentication successful. Redirecting..." : "Autentificare reu\u0219it\u0103. Redirec\u021bionare...")}
              {status === "success" && isPasswordRecovery && (language === "en" ? "Redirecting to set new password..." : "Redirec\u021bionare pentru parola nou\u0103...")}
              {status === "error" && errorMessage}
            </CardDescription>
          </CardHeader>
          {status === "error" && (
            <CardContent className="space-y-3">
              <Button
                className="w-full rounded-full h-12 font-serif italic"
                onClick={() => navigate(isEmailVerificationFlow ? "/auth?mode=signup" : "/auth")}
              >
                {isEmailVerificationFlow
                  ? (language === "en" ? "Back to Sign Up" : "\u00cenapoi la \u00cenregistrare")
                  : (language === "en" ? "Back to Login" : "\u00cenapoi la Autentificare")}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full h-12 font-serif italic"
                onClick={() => navigate("/")}
              >
                {language === "en" ? "Go to Home" : "Mergi la Acas\u0103"}
              </Button>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default AuthCallback;
