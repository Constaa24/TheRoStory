import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/layout/PageHead";

type Status = "loading" | "success" | "error";
type ErrorKind = "invalid" | "expired" | "server";

const NewsletterConfirm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const [status, setStatus] = useState<Status>("loading");
  const [errorKind, setErrorKind] = useState<ErrorKind>("invalid");
  // The confirm call must run exactly once, even under StrictMode's
  // double-mount in dev.
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const token = searchParams.get("token") || "";
    if (!token) {
      setStatus("error");
      setErrorKind("invalid");
      return;
    }

    supabase.functions
      .invoke("newsletter-confirm", { body: { token } })
      .then(({ data, error }) => {
        if (error || !data) {
          setStatus("error");
          setErrorKind("server");
          return;
        }
        if (data.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorKind(
            data.error === "expired" ? "expired" : data.error === "server" ? "server" : "invalid"
          );
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorKind("server");
      });
  }, [searchParams]);

  const copy = {
    loading: language === "en" ? "Confirming your subscription…" : "Se confirmă abonarea…",
    successTitle: language === "en" ? "You're in!" : "Gata!",
    successBody: language === "en"
      ? "Your subscription is confirmed. One letter a month, from the road — see you in your inbox."
      : "Abonarea ta este confirmată. O scrisoare pe lună, de pe drum — ne vedem în inbox.",
    errorTitle: language === "en" ? "Confirmation failed" : "Confirmarea a eșuat",
    invalid: language === "en"
      ? "This confirmation link is invalid. Try subscribing again from the home page."
      : "Acest link de confirmare este invalid. Încearcă să te abonezi din nou de pe pagina principală.",
    expired: language === "en"
      ? "This confirmation link has expired. Subscribe again from the home page to get a fresh one."
      : "Acest link de confirmare a expirat. Abonează-te din nou de pe pagina principală pentru unul nou.",
    server: language === "en"
      ? "Something went wrong on our side. Please try again in a few minutes."
      : "Ceva nu a mers la noi. Te rugăm să încerci din nou în câteva minute.",
    home: language === "en" ? "Back to Home" : "Înapoi la Acasă",
  };

  return (
    <div className="ed-container py-20 flex justify-center items-center min-h-[70vh]">
      <PageHead
        title={language === "en" ? "Newsletter confirmation" : "Confirmare abonare"}
        description={language === "en"
          ? "Confirm your RoStory newsletter subscription."
          : "Confirmă abonarea la buletinul RoStory."}
        language={language}
      >
        <meta name="robots" content="noindex, nofollow" />
      </PageHead>
      <Card className="border-line bg-[color:var(--ink-2)]/60 backdrop-blur-md text-center rounded-sm max-w-md w-full">
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
          <CardTitle className="text-3xl font-display italic text-[color:var(--parchment)]">
            {status === "loading" && copy.loading}
            {status === "success" && copy.successTitle}
            {status === "error" && copy.errorTitle}
          </CardTitle>
          {status !== "loading" && (
            <CardDescription className="text-muted-foreground font-serif italic text-lg">
              {status === "success" ? copy.successBody : copy[errorKind]}
            </CardDescription>
          )}
        </CardHeader>
        {status !== "loading" && (
          <CardContent>
            <Button asChild className="w-full rounded-full h-12 font-serif italic">
              <Link to="/">{copy.home}</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default NewsletterConfirm;
