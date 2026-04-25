import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Article, getLocalized } from "@/lib/supabase";
import { fetchPublicArticle, incrementView } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { ParchmentArticle } from "@/components/organisms/ParchmentArticle";
import { logError } from "@/lib/utils";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const [article, setArticle] = useState<Article | null>(null);
  const [views, setViews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Get the referrer path from location state, default to home
  const fromState = location.state as { from?: string; category?: string; selectedLocation?: string } | null;
  const fromPath = fromState?.from || "/";
  const fromCategory = fromState?.category;
  const selectedLocation = fromState?.selectedLocation;

  useEffect(() => {
    if (id) {
      fetchArticle(id);
      // Increment view count on open
      incrementView(id);
    }
  }, [id]);

  const fetchArticle = async (articleId: string) => {
    setIsLoading(true);
    try {
      const { article, views } = await fetchPublicArticle(articleId);
      if (article) {
        setArticle(article);
        setViews(views);
      } else {
        navigate(fromPath, { replace: true });
      }
    } catch (error) {
      logError("ArticleDetail.fetchArticle", error);
      navigate(fromPath, { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // If we came from categories with a category selected, preserve it in the URL
    if (fromPath === "/categories" && fromCategory) {
      navigate(`/categories?category=${fromCategory}`);
    } else {
      navigate(fromPath, { state: { selectedLocation } });
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-2xl font-serif text-accent">Opening Scroll...</div>
      </div>
    );
  }

  if (!article) return null;

  const title = getLocalized(article, "title", language);
  const description = getLocalized(article, "content", language).substring(0, 160);
  const imageUrl =
    article.posterUrl ||
    article.mediaUrl ||
    article.mediaUrls?.[0] ||
    `${SITE_URL}/og-image.png`;
  const articleUrl = `${SITE_URL}/article/${article.id}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: imageUrl,
    datePublished: article.createdAt,
    dateModified: article.createdAt,
    inLanguage: language === "en" ? "en" : "ro",
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
  };

  return (
    <>
      <Helmet>
        <title>{title} — {SITE_NAME}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content={language === "en" ? "en_US" : "ro_RO"} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <ParchmentArticle
        article={article}
        views={views}
        incrementViewOnOpen={false}
        onClose={handleClose}
      />
    </>
  );
};

export default ArticleDetailPage;
