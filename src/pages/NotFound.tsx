import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { PageHead } from "@/components/layout/PageHead";
import { fetchRandomArticle } from "@/lib/supabase";

/**
 * 404 view for unknown routes (the redesign's SystemPages, not found).
 * Previously these redirected to "/", which search engines see as a
 * soft-404. Rendering a real "not found" page with a noindex directive gives
 * a clearer signal and a better dead-end experience. (Vercel still serves
 * HTTP 200 for the SPA shell, but noindex keeps these URLs out of the index.)
 */
const NotFound: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const en = language === "en";

  const random = async () => {
    const a = await fetchRandomArticle().catch(() => null);
    if (a) navigate(`/article/${a.id}`);
  };
  // The header's search listens for ⌘K / Ctrl K; the same key opens it from here.
  const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));

  return (
    <div className="rs-in">
      <PageHead
        title={en ? "Page not found" : "Pagină negăsită"}
        description={en
          ? "The page you were looking for could not be found."
          : "Pagina pe care o căutai nu a putut fi găsită."}
        language={language}
      >
        <meta name="robots" content="noindex, follow" />
      </PageHead>

      {/* At least a screen tall, like the loader before it: shorter, and the
          footer rose into view as the page arrived (a layout shift). */}
      <section className="ed-container flex items-center" style={{ minHeight: 'calc(100vh - 73px)', maxWidth: 1100, paddingTop: 'clamp(56px, 8vw, 120px)', paddingBottom: 'clamp(56px, 8vw, 120px)' }}>
        <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-[clamp(36px,5vw,72px)] items-center w-full">
          <div className="grid place-items-center w-full max-w-[380px] justify-self-center" style={{ aspectRatio: '4 / 4.6', borderRadius: '50% 50% 14px 14px / 30% 30% 14px 14px', border: '1.5px dashed var(--gold-deep)' }} aria-hidden="true">
            <span className="font-display italic" style={{ fontSize: 'clamp(90px, 12vw, 150px)', lineHeight: 1, color: 'var(--gold)' }}>404</span>
          </div>
          <div className="flex flex-col gap-5">
            <p className="rs-eyebrow">{en ? 'Not found' : 'Negăsit'}</p>
            <h1 className="rs-display" style={{ fontSize: 'clamp(44px, 5.4vw, 80px)', lineHeight: 0.98 }}>
              {en ? 'This page wandered off the map.' : 'Pagina aceasta a ieșit de pe hartă.'}
            </h1>
            <p className="m-0" style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text-dim)' }}>
              {en
                ? 'The link may be old, or the story may have moved to another shelf. The archive is still here.'
                : 'Linkul poate fi vechi sau povestea s-a mutat pe alt raft. Arhiva e tot aici.'}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link to="/" className="rs-btn">{en ? 'Back to the stories' : 'Înapoi la povești'}</Link>
              <button type="button" className="rs-btn rs-btn-ghost" onClick={openSearch}>{en ? 'Search the archive' : 'Caută în arhivă'}</button>
              <button type="button" className="rs-btn rs-btn-ghost" onClick={random}>{en ? 'A story at random' : 'O poveste la întâmplare'}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NotFound;
