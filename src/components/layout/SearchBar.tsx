import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Article, Category, searchArticles, fetchCategories, getLocalized } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

// Module-level cache — categories don't change during a session
let _categoriesCache: Category[] | null = null;
const getCachedCategories = () => {
  if (_categoriesCache) return Promise.resolve(_categoriesCache);
  return fetchCategories().then((cats) => { _categoriesCache = cats; return cats; });
};

export const SearchBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number>();
  const searchRequestIdRef = useRef(0);

  // Load categories once for result subtitle display
  useEffect(() => {
    getCachedCategories().then(setCategories).catch(() => {});
  }, []);

  // Debounced DB search on every query change
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      window.clearTimeout(debounceRef.current);
      return;
    }

    setIsSearching(true);
    window.clearTimeout(debounceRef.current);
    const requestId = ++searchRequestIdRef.current;
    debounceRef.current = window.setTimeout(async () => {
      try {
        const articles = await searchArticles(q);
        if (searchRequestIdRef.current !== requestId) return;
        setResults(articles);
        setFetchError(false);
      } catch {
        if (searchRequestIdRef.current !== requestId) return;
        setFetchError(true);
        setResults([]);
      } finally {
        if (searchRequestIdRef.current === requestId) setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setIsSearching(false);
    window.clearTimeout(debounceRef.current);
  };

  const handleSelect = (article: Article) => {
    close();
    navigate(`/article/${article.id}`);
  };

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative h-9 w-9 flex items-center justify-end">
      {/* Trigger button — keeps a fixed slot in the navbar so other items don't shift */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "rounded-full h-9 w-9 transition-opacity",
          isOpen && "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(true)}
        aria-label={t("search.label")}
        aria-expanded={isOpen}
      >
        <Search className="h-5 w-5" />
      </Button>

      {/* Expanded search — anchored to the right, grows leftward over empty navbar space */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="search-open"
            initial={{ opacity: 0, width: 36 }}
            animate={{ opacity: 1, width: 320 }}
            exit={{ opacity: 0, width: 36 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-0 h-9 flex items-center gap-1.5 overflow-hidden"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full pl-9 pr-8 py-2 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-[box-shadow]"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin pointer-events-none" />
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 shrink-0"
              onClick={close}
              aria-label={t("search.close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDropdown && !isSearching && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute top-full mt-2 right-0 w-72 sm:w-80 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-[60]"
          >
            {fetchError ? (
              <div className="p-5 text-center text-sm text-muted-foreground font-serif italic">
                Search unavailable — please try again later.
              </div>
            ) : results.length > 0 ? (
              results.map((article) => {
                const cat = categories.find((c) => c.id === article.categoryId);
                const thumb =
                  article.type === "video"
                    ? article.posterUrl
                    : article.type === "carousel"
                    ? article.mediaUrls?.[0] ?? article.mediaUrl
                    : article.mediaUrl;
                return (
                  <button
                    key={article.id}
                    onClick={() => handleSelect(article)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors text-left border-b border-border/30 last:border-0 focus:outline-none focus:bg-accent/5"
                  >
                    <div className="h-11 w-11 rounded-lg overflow-hidden shrink-0 bg-secondary/20">
                      {thumb && (
                        <img
                          src={thumb}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-serif font-semibold text-foreground truncate">
                        {getLocalized(article, "title", language)}
                      </p>
                      {cat && (
                        <p className="text-xs text-accent truncate">
                          {getLocalized(cat, "name", language)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-5 text-center text-sm text-muted-foreground font-serif italic">
                {t("search.noResults")}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
