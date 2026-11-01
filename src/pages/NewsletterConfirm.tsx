import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-none text-center rounded-[26px] max-w-md w-full">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {status === "loading" && (
              <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--line)" }}>
                <Loader2 className="h-8 w-8 text-accent animate-spin" />
              </div>
            )}
            {status === "success" && (
              <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--gold-deep)", background: "var(--glow)" }}>
                <CheckCircle2 className="h-8 w-8" style={{ color: "var(--gold)" }} />
              </div>
            )}
            {status === "error" && (
              <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--line)" }}>
                <AlertCircle className="h-8 w-8" style={{ color: "var(--oxblood-2)" }} />
              </div>
            )}
          </div>
          <CardTitle className="sb-h3" style={{ fontSize: 32 }}>
            {status === "loading" && copy.loading}
            {status === "success" && copy.successTitle}
            {status === "error" && copy.errorTitle}
          </CardTitle>
          {status !== "loading" && (
            <CardDescription className="font-display italic text-[19px] text-[color:var(--text-dim)]">
              {status === "success" ? copy.successBody : copy[errorKind]}
            </CardDescription>
          )}
        </CardHeader>
        {status !== "loading" && (
          <CardContent>
            <Link to="/" className="sb-btn w-full">{copy.home}</Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default NewsletterConfirm;
