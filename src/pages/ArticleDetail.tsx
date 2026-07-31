import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Article, getLocalized } from "@/lib/supabase";
import { fetchPublicArticle, incrementView } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { EditorialArticle } from "@/components/organisms/EditorialArticle";
import { logError, toJsonLd } from "@/lib/utils";
import { articleCoverUrl, articleExcerpt } from "@/lib/article-utils";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const [article, setArticle] = useState<Article | null>(null);
  const [views, setViews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fromState = location.state as { from?: string } | null;
  const fromPath = fromState?.from || "/";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const { article, views } = await fetchPublicArticle(id);
        if (cancelled) return;
        if (article) {
          setArticle(article);
          setViews(views);
          // Count the view only once we know the article exists and is
          // published — firing earlier counted drafts and produced noise
          // for nonexistent ids. (The RPC also guards server-side now.)
          incrementView(id);
        } else {
          navigate(fromPath, { replace: true });
        }
      } catch (error) {
        if (cancelled) return;
        logError("ArticleDetail.fetchArticle", error);
        navigate(fromPath, { replace: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="font-display italic text-2xl" style={{ color: 'var(--gold)' }}>
          {language === 'en' ? 'Opening the page…' : 'Se deschide pagina…'}
        </div>
      </div>
    );
  }

  if (!article) return null;

  const title = getLocalized(article, "title", language);
  // articleExcerpt strips the |||CHAPTER||| delimiter — substring() leaked
  // it into the meta description of multi-chapter stories.
  const description = articleExcerpt(article, language, 160);
  const imageUrl = articleCoverUrl(article) || `${SITE_URL}/og-image.jpg`;
  const articleUrl = `${SITE_URL}/article/${article.id}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: imageUrl,
    datePublished: article.createdAt,
    dateModified: article.updatedAt || article.createdAt,
    inLanguage: language === "en" ? "en" : "ro",
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: language === "en" ? "Home" : "Acasă", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: title, item: articleUrl },
    ],
  };

  return (
    <>
      {/* Routed through PageHead like every other page rather than
          hand-rolling the tags: the local copy had drifted and was missing
          og:image:width/height/alt and twitter:image:alt, which social
          previews use to lay the card out. og:type goes through the prop —
          passing it as a child would emit a second og:type rather than
          replacing PageHead's default. */}
      <PageHead
        title={title}
        description={description}
        imageUrl={imageUrl}
        language={language}
        canonical={articleUrl}
        ogType="article"
      >
        <meta property="article:published_time" content={article.createdAt} />
        <meta
          property="article:modified_time"
          content={article.updatedAt || article.createdAt}
        />
        <script type="application/ld+json">{toJsonLd(jsonLd)}</script>
        <script type="application/ld+json">{toJsonLd(breadcrumbLd)}</script>
      </PageHead>
      <EditorialArticle article={article} views={views} />
    </>
  );
};

export default ArticleDetailPage;
