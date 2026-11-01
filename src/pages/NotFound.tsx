import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { PageHead } from "@/components/layout/PageHead";

/**
 * 404 view for unknown routes. Previously these redirected to "/", which
 * search engines see as a soft-404. Rendering a real "not found" page with a
 * noindex directive gives a clearer signal and a better dead-end experience.
 * (Vercel still serves HTTP 200 for the SPA shell, but noindex keeps these
 * URLs out of the index.)
 */
const NotFound: React.FC = () => {
  const { language } = useLanguage();

  return (
    <div className="screen-anim">
      <PageHead
        title={language === "en" ? "Page not found" : "Pagină negăsită"}
        description={language === "en"
          ? "The page you were looking for could not be found."
          : "Pagina pe care o căutai nu a putut fi găsită."}
        language={language}
      >
        <meta name="robots" content="noindex, follow" />
      </PageHead>

      <section className="ed-container text-center" style={{ paddingTop: 'clamp(72px, 10vw, 120px)', paddingBottom: 'clamp(88px, 11vw, 140px)' }}>
        {/* The thread, snapped: it runs in from the left, frays at a knot,
            and picks up again further on. */}
        <div aria-hidden="true" className="flex items-center justify-center mx-auto mb-14" style={{ maxWidth: 620 }}>
          <span className="sb-thread" style={{ flex: 1, opacity: 0.7 }} />
          <span className="sb-knot" style={{ marginInline: 14 }} />
          <span className="sb-thread" style={{ width: 70, opacity: 0.7, transform: 'rotate(-14deg)', transformOrigin: 'left center' }} />
          <span style={{ width: 'clamp(40px, 18vw, 150px)' }} />
          <span className="sb-thread" style={{ width: 70, opacity: 0.35, transform: 'rotate(10deg)', transformOrigin: 'right center' }} />
          <span className="sb-thread" style={{ flex: 1, opacity: 0.35 }} />
        </div>
        <p className="sb-kicker">{language === "en" ? "404 · this page is not in the archive" : "404 · această pagină nu e în arhivă"}</p>
        <h1 className="sb-h1 mt-4">{language === "en" ? "Lost the thread." : "Firul s-a pierdut."}</h1>
        <p className="sb-lede mx-auto mt-6" style={{ maxWidth: 540 }}>
          {language === "en"
            ? "This page doesn't exist — it may have moved, or the link is mistyped. Let's get you back to the archive."
            : "Această pagină nu există — poate a fost mutată sau linkul este greșit. Hai înapoi la arhivă."}
        </p>
        <div className="flex items-center justify-center gap-3 mt-11 flex-wrap">
          <Link to="/" className="sb-btn">
            {language === "en" ? "Back to home" : "Înapoi acasă"}
          </Link>
          <Link to="/categories" className="sb-btn sb-btn-ghost">
            {language === "en" ? "Browse the archive" : "Explorează arhiva"}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default NotFound;
