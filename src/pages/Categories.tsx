import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArchiveEntry, Category, getLocalized, fetchArchiveIndex, fetchCategories, fetchArticleCategoryCounts, fetchRandomArticle } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { isAbortError, toJsonLd } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_URL } from "@/lib/constants";
import { LoadError } from "@/components/ui/load-error";
import { localizedPath } from "@/lib/locale";
import { countLabel } from "@/lib/article-utils";
import { categoryDescription, categoryImageSources, getCategoryImage } from "@/lib/category-copy";
import { splitTitle } from "@/lib/story-facts";
import { ChapterHead, Divider } from "@/components/story/Ornaments";

// "Eight shelves of stories." — the number spelled out, as a book would.
const NUMBER_WORDS = {
  en: ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'],
  // Neuter plural, to agree with "rafturi": două rafturi, douăsprezece rafturi.
  ro: ['', 'Un', 'Două', 'Trei', 'Patru', 'Cinci', 'Șase', 'Șapte', 'Opt', 'Nouă', 'Zece', 'Unsprezece', 'Douăsprezece'],
} as const;

const shelvesHeading = (n: number, language: 'en' | 'ro'): string => {
  const word = NUMBER_WORDS[language][n] ?? String(n);
  if (language === 'ro') return n === 1 ? 'Un raft de povești.' : `${word} rafturi de povești.`;
  return n === 1 ? 'One shelf of stories.' : `${word} shelves of stories.`;
};

const Categories: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [archiveIndex, setArchiveIndex] = useState<ArchiveEntry[]>([]);
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
      const [cats, counts] = await Promise.all([
        fetchCategories(),
        fetchArticleCategoryCounts(),
      ]);
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

  // The "Inside: …" line under each shelf. Optional garnish: a failure
  // leaves the line off rather than failing the page.
  useEffect(() => {
    let cancelled = false;
    fetchArchiveIndex()
      .then((rows) => { if (!cancelled) setArchiveIndex(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const insideOf = useMemo(() => {
    const byShelf = new Map<string, string[]>();
    for (const entry of archiveIndex) {
      const titles = byShelf.get(entry.categoryId) ?? [];
      if (titles.length < 2) {
        titles.push(splitTitle(getLocalized(entry, 'title', language)).main);
        byShelf.set(entry.categoryId, titles);
      }
    }
    return byShelf;
  }, [archiveIndex, language]);

  const handleRandomStory = async () => {
    const a = await fetchRandomArticle();
    if (a) navigate(`/article/${a.id}`, { state: { from: '/categories' } });
  };

  const pageTitle = en ? "Categories" : "Categorii";
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
    <div className="screen-anim">
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{toJsonLd(itemListLd)}</script>
      </PageHead>

      <section className="ed-container" style={{ paddingTop: 'clamp(48px, 6vw, 72px)', paddingBottom: 56 }}>
        <ChapterHead
          as="h1"
          kicker={en ? 'Routes through the archive' : 'Trasee prin arhivă'}
          title={categories.length ? shelvesHeading(categories.length, language) : (en ? 'The shelves.' : 'Rafturile.')}
        >
          <p className="sb-lede max-w-[620px]">
            {en
              ? 'Pick the kind of story you’re in the mood for — a legend, a poem, a person, a place — and follow it wherever it leads.'
              : 'Alege ce fel de poveste ți-e dor să citești — o legendă, un poem, un om, un loc — și urmeaz-o oriunde te-ar duce.'}
          </p>
        </ChapterHead>
      </section>

      <section className="ed-container" style={{ paddingBottom: 96 }}>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-14">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="sb-arch animate-pulse" style={{ aspectRatio: '3 / 4' }} />
            ))}
          </div>
        ) : loadFailed ? (
          <LoadError onRetry={loadData} />
        ) : (
          <ul className="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-14">
            {categories.map((category, index) => {
              const name = getLocalized(category, 'name', language);
              const count = categoryCounts[category.id] ?? 0;
              const base = getCategoryImage(category.slug || name.toLowerCase());
              const inside = insideOf.get(category.id);
              return (
                <li key={category.id}>
                  <Link to={`/category/${category.id}`} className="sb-card grid gap-3.5">
                    <div className="sb-window" style={{ padding: 8 }}>
                      <div className="sb-arch sb-card-media" style={{ aspectRatio: '3 / 4' }}>
                        <picture>
                          <source type="image/avif" srcSet={categoryImageSources(base).avif} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw" />
                          <source type="image/webp" srcSet={categoryImageSources(base).webp} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw" />
                          <img
                            src={`${base}.jpg`}
                            alt=""
                            width={1024}
                            height={1024}
                            // The first row is on screen as the page opens (the
                            // first door is its largest picture on a phone):
                            // lazy loading held those back until layout, about
                            // 3 s later on a throttled phone.
                            loading={index < 4 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : undefined}
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        </picture>
                        <div className="sb-scrim" style={{ opacity: 0.55 }} />
                        <span className="sb-tag whitespace-nowrap" style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)' }}>
                          {countLabel(count, 'story', language)}
                        </span>
                      </div>
                    </div>
                    <h2 className="sb-h3 text-center mt-1.5">{name}</h2>
                    <p className="sb-dim text-center" style={{ fontSize: 16.5, lineHeight: 1.55 }}>
                      {categoryDescription(category.slug || name.toLowerCase(), name, language)}
                    </p>
                    {inside && inside.length > 0 && (
                      <>
                        <Divider className="mt-1" />
                        <p className="sb-kicker-sm text-center" style={{ color: 'var(--text-dim)', fontSize: 16 }}>
                          {en ? 'Inside: ' : 'Înăuntru: '}{inside.join(', ')}
                        </p>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="sb-band">
        <div className="ed-container flex flex-wrap justify-between items-center gap-7" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="flex flex-col gap-2.5">
            <p className="sb-kicker">{en ? 'Not sure where to begin?' : 'Nu știi de unde să începi?'}</p>
            <h2 className="sb-h2" style={{ fontSize: 'clamp(30px, 3.4vw, 46px)' }}>
              {en ? 'Let the map, or chance, choose for you.' : 'Lasă harta, sau norocul, să aleagă pentru tine.'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/map" className="sb-btn">{en ? 'Open the map →' : 'Deschide harta →'}</Link>
            <button type="button" className="sb-btn sb-btn-ghost" onClick={handleRandomStory}>
              {en ? 'Tell me a story at random' : 'Spune-mi o poveste la întâmplare'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Categories;
