import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { AlertCircle, Loader2 } from "lucide-react";
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
    <div className="ed-container rs-in flex justify-center items-center" style={{ minHeight: '70vh', paddingTop: 'clamp(56px, 8vw, 120px)', paddingBottom: 48 }}>
      <PageHead
        title={language === "en" ? "Newsletter confirmation" : "Confirmare abonare"}
        description={language === "en"
          ? "Confirm your RoStory newsletter subscription."
          : "Confirmă abonarea la buletinul RoStory."}
        language={language}
      >
        <meta name="robots" content="noindex, nofollow" />
      </PageHead>
      {/* A letter, on dashed-edged paper. */}
      <div className="w-full text-center" style={{ maxWidth: 640, padding: 'clamp(36px, 5vw, 64px)', borderRadius: 28, border: '1.5px dashed var(--gold-deep)', background: 'var(--paper)' }}>
        {status === "loading" ? (
          <div role="status" className="flex flex-col items-center gap-[18px] py-8">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--gold)' }} aria-hidden="true" />
            <p className="m-0 font-display italic" style={{ fontSize: 24, color: 'var(--text-dim)' }}>{copy.loading}</p>
          </div>
        ) : (
          <>
            {status === "success" ? (
              <picture>
                <source type="image/webp" srcSet="/logo-128.webp" />
                <img src="/logo-128.png" alt="" width={64} height={64} className="mx-auto mb-5 w-16 h-16 object-contain" />
              </picture>
            ) : (
              <AlertCircle className="mx-auto mb-5 h-10 w-10" style={{ color: 'var(--danger)' }} aria-hidden="true" />
            )}
            <h1 className="rs-display" style={{ margin: '0 0 12px', fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1 }}>
              {status === "success" ? copy.successTitle : copy.errorTitle}
            </h1>
            <p className="m-0 mb-[26px]" style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-dim)' }}>
              {status === "success" ? copy.successBody : copy[errorKind]}
            </p>
            <Link to="/" className={status === "success" ? "rs-btn" : "rs-btn rs-btn-ghost"}>{copy.home}</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsletterConfirm;
