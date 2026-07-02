import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { toggleFavorite, supabase } from "@/lib/supabase";
import { isAbortError } from "@/lib/utils";
import { toast } from "sonner";

interface FavoritesContextType {
  userFavorites: string[];
  handleFavoriteToggle: (e: React.MouseEvent, articleId: string) => Promise<boolean | null | undefined>;
  isFavorited: (articleId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

/**
 * Single source of truth for the current user's favorited article ids.
 * Previously every component calling useFavorites() (Home, CategoryDetail,
 * EditorialArticle, …) held its own copy and fired its own favorites query
 * on mount; the provider fetches once per user session and keeps every
 * heart icon in sync.
 */
export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login } = useAuth();
  const { language } = useLanguage();
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const togglingRef = useRef(new Set<string>());

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    const currentFetchId = ++fetchIdRef.current;
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('article_id')
        .eq('user_id', user.id);

      if (error) throw error;
      // Only apply if this is still the latest fetch (user hasn't changed)
      if (mountedRef.current && fetchIdRef.current === currentFetchId) {
        setUserFavorites(data.map((f: { article_id: string }) => f.article_id));
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error fetching favorites:", error);
      }
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    if (user) {
      fetchFavorites();
    } else {
      setUserFavorites([]);
    }
    return () => { mountedRef.current = false; };
  }, [user, fetchFavorites]);

  const handleFavoriteToggle = useCallback(async (e: React.MouseEvent, articleId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error(language === 'en' ? "Please log in to favorite articles" : "Vă rugăm să vă autentificați pentru a salva articolele favorite");
      login();
      return;
    }

    if (togglingRef.current.has(articleId)) return;
    togglingRef.current.add(articleId);

    try {
      const added = await toggleFavorite(articleId);
      if (added) {
        setUserFavorites(prev => [...prev, articleId]);
        toast.success(language === 'en' ? "Added to favorites" : "Adăugat la favorite");
      } else {
        setUserFavorites(prev => prev.filter(fav => fav !== articleId));
        toast.success(language === 'en' ? "Removed from favorites" : "Eliminat de la favorite");
      }
      return added;
    } catch {
      toast.error(language === 'en' ? "Failed to update favorites" : "Eroare la actualizarea favoritelor");
      return null;
    } finally {
      togglingRef.current.delete(articleId);
    }
  }, [user, language, login]);

  const isFavorited = useCallback(
    (articleId: string) => userFavorites.includes(articleId),
    [userFavorites]
  );

  return (
    <FavoritesContext.Provider value={{ userFavorites, handleFavoriteToggle, isFavorited }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
