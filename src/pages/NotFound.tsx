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

      <section className="ed-container" style={{ padding: "120px 0 140px", textAlign: "center" }}>
        <div className="eyebrow mb-4">404</div>
        <h1
          className="font-display italic font-medium m-0"
          style={{ fontSize: "clamp(56px, 9vw, 140px)", lineHeight: 0.95, letterSpacing: "-0.01em", color: "var(--parchment)" }}
        >
          {language === "en" ? "Lost the thread." : "Firul s-a pierdut."}
        </h1>
        <p className="mt-6 mx-auto" style={{ maxWidth: 520, fontSize: 19, color: "var(--text-dim)", lineHeight: 1.55 }}>
          {language === "en"
            ? "This page doesn't exist — it may have moved, or the link is mistyped. Let's get you back to the archive."
            : "Această pagină nu există — poate a fost mutată sau linkul este greșit. Hai înapoi la arhivă."}
        </p>
        <div className="flex items-center justify-center gap-3.5 mt-10 flex-wrap">
          <Link to="/" className="btn-ed">
            {language === "en" ? "Back to home" : "Înapoi acasă"}
          </Link>
          <Link to="/categories" className="btn-ed btn-ed-ghost">
            {language === "en" ? "Browse the archive" : "Explorează arhiva"}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default NotFound;
