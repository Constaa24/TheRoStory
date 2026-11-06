import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Motif } from "@/components/story/Ornaments";
import { Category, getLocalized, fetchCategories, fetchArticleCategoryCounts, fetchRandomArticle } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { isAbortError, toJsonLd } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_URL } from "@/lib/constants";
import { LoadError } from "@/components/ui/load-error";
import { localizedPath } from "@/lib/locale";
import { countLabel } from "@/lib/article-utils";
import { categoryDescription, categoryImageSources, getCategoryImage } from "@/lib/category-copy";
import { toRoman } from "@/lib/story-facts";

// "Eight shelves, one country." — the number spelled out, as a book would.
const NUMBER_WORDS = {
  en: ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'],
  // Neuter plural, to agree with "rafturi": două rafturi, douăsprezece rafturi.
  ro: ['', 'Un', 'Două', 'Trei', 'Patru', 'Cinci', 'Șase', 'Șapte', 'Opt', 'Nouă', 'Zece', 'Unsprezece', 'Douăsprezece'],
} as const;

const shelvesHeading = (n: number, language: 'en' | 'ro'): string => {
  const word = NUMBER_WORDS[language][n] ?? String(n);
  if (language === 'ro') return n === 1 ? 'Un raft, o singură țară.' : `${word} rafturi, o singură țară.`;
  return n === 1 ? 'One shelf, one country.' : `${word} shelves, one country.`;
};

/** The shelves (the redesign's Shelves index): every shelf as an arched door. */
const Categories: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const en = language === 'en';

  // Hoisted out of the effect so the failure state can re-run it. An abort is
  // not a failure — it means a newer load superseded this one — so it clears
  // nothing and shows nothing.
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const [cats, counts] = await Promise.all([fetchCategories(), fetchArticleCategoryCounts()]);
      setCategories(cats);
      setCategoryCounts(counts);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading content:", error);
        setLoadFailed(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRandomStory = async () => {
    const a = await fetchRandomArticle().catch(() => null);
    if (a) navigate(`/article/${a.id}`, { state: { from: '/categories' } });
  };

  const pageTitle = en ? "Shelves" : "Rafturi";
  const pageDescription = en
    ? "Browse stories of Romania organized by theme — history, traditions, nature, food, regions, and more."
    : "Răsfoiește poveștile României organizate pe teme — istorie, tradiții, natură, mâncare, regiuni și multe altele.";

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: categories.map((cat, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: getLocalized(cat, "name", language),
      url: `${SITE_URL}${localizedPath(language, `/category/${cat.id}`)}`,
    })),
  };

  return (
    <div className="rs-in">
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{toJsonLd(itemListLd)}</script>
      </PageHead>

      <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 80px)' }}>
        <p className="rs-eyebrow" style={{ marginBottom: 14 }}>{en ? 'The shelves' : 'Rafturile'}</p>
        <div className="grid grid-cols-1 min-[1000px]:grid-cols-[1.3fr_1fr] gap-x-16 gap-y-6 items-end" style={{ marginBottom: 'clamp(40px, 6vw, 72px)' }}>
          <h1 className="rs-display" style={{ fontSize: 'clamp(52px, 7vw, 112px)', lineHeight: 0.94, letterSpacing: '-0.025em' }}>
            {categories.length ? shelvesHeading(categories.length, language) : (en ? 'The shelves.' : 'Rafturile.')}
          </h1>
          <p className="m-0 mb-2" style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text-dim)', textWrap: 'pretty' }}>
            {en
              ? 'The archive, sorted the way a reader wanders: by what a story is about. Pick a shelf and pull something down.'
              : 'Arhiva, ordonată așa cum rătăcește un cititor: după ce e povestea. Alege un raft și ia ceva de pe el.'}
          </p>
        </div>

        {isLoading ? (
          <div className="rs-shelves">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rs-card-frame animate-pulse" />
            ))}
          </div>
        ) : loadFailed ? (
          <LoadError onRetry={loadData} />
        ) : (
          <ul className="rs-shelves list-none m-0 p-0">
            {categories.map((category, index) => {
              const name = getLocalized(category, 'name', language);
              const count = categoryCounts[category.id] ?? 0;
              const base = getCategoryImage(category.slug || name.toLowerCase());
              return (
                <li key={category.id}>
                  <Link to={`/category/${category.id}`} className="rs-shelf rs-card">
                    <span className="rs-shelf-window">
                      <span className="rs-card-frame block" style={{ boxShadow: 'none' }}>
                        <picture>
                          <source type="image/avif" srcSet={categoryImageSources(base).avif} sizes="(min-width: 1100px) 22vw, (min-width: 640px) 45vw, 92vw" />
                          <source type="image/webp" srcSet={categoryImageSources(base).webp} sizes="(min-width: 1100px) 22vw, (min-width: 640px) 45vw, 92vw" />
                          <img
                            src={`${base}.jpg`}
                            alt=""
                            width={1024}
                            height={1024}
                            // The first row is on screen as the page opens:
                            // lazy loading held those back until layout,
                            // about 3 s later on a throttled phone.
                            loading={index < 4 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : undefined}
                            decoding="async"
                            className="rs-card-img"
                          />
                        </picture>
                        <span className="sb-scrim" />
                        <span aria-hidden="true" className="absolute inset-x-0 bottom-[18px] text-center font-display italic" style={{ fontSize: 22, color: '#f4ead7' }}>
                          {toRoman(index + 1)}
                        </span>
                      </span>
                    </span>
                    <h2 className="rs-display" style={{ marginTop: 20, fontSize: 32, lineHeight: 1.02, letterSpacing: 0 }}>{name}</h2>
                    <span className="block mt-2" style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text-dim)', textWrap: 'pretty' }}>
                      {categoryDescription(category.slug || name.toLowerCase(), name, language)}
                    </span>
                    <span className="block mt-3" style={{ fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>
                      {countLabel(count, 'story', language)} →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ed-container" style={{ paddingTop: 'clamp(64px, 8vw, 112px)' }}>
        <div className="rs-band relative flex flex-wrap justify-between items-center gap-7" style={{ padding: 'clamp(28px, 4vw, 48px)', borderRadius: 24, border: '1px solid var(--line-soft)' }}>
          <Motif className="absolute" style={{ left: 32, right: 32, top: 0, transform: 'translateY(-50%)', opacity: 0.45 }} />
          <div className="flex flex-col gap-2.5">
            <p className="rs-eyebrow">{en ? 'Not sure where to begin?' : 'Nu știi de unde să începi?'}</p>
            <h2 className="rs-display" style={{ fontSize: 'clamp(30px, 3.4vw, 46px)', lineHeight: 1.05 }}>
              {en ? 'Let the map, or chance, choose for you.' : 'Lasă harta, sau norocul, să aleagă pentru tine.'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/map" className="rs-btn">{en ? 'Open the map →' : 'Deschide harta →'}</Link>
            <button type="button" className="rs-btn rs-btn-ghost" onClick={handleRandomStory}>
              {en ? 'A story at random' : 'O poveste la întâmplare'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Categories;
