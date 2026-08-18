import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./hooks/use-auth";
import { FavoritesProvider } from "./hooks/use-favorites";
import { LanguageProvider } from "./hooks/use-language";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";

import { isAbortError } from "./lib/utils";
import { basenameFor, detectLanguage, localizedPath } from "./lib/locale";

// Global unhandled rejection handler to catch noisy abort errors from browser/libraries
window.addEventListener("unhandledrejection", (event) => {
  if (isAbortError(event.reason)) {
    event.preventDefault();
  }
});

// index.html ships fallback SEO tags for crawlers that don't run JavaScript.
// Every routed page renders its own via PageHead, so drop the static ones
// before React mounts — leaving them in produces duplicate (and for OG/
// description, conflicting) signals for JS-rendering crawlers like Googlebot.
document.head.querySelectorAll("[data-static-seo]").forEach((el) => el.remove());

/**
 * Returning Romanian readers kept their choice in localStorage back when that
 * was the entire language mechanism. Honour it once, on an unprefixed URL, so
 * moving to URL-based locales doesn't silently reset all of them to English.
 *
 * Deliberately narrow. Only from the unprefixed tree, and only for an explicit
 * stored 'ro' — the URL always outranks the preference, so /article/x stays
 * English even for a reader whose preference is Romanian, because they asked
 * for that specific page. Crawlers have no localStorage, so they never take
 * this path and always get the English tree at the bare path, which is what
 * the x-default hreflang promises them.
 *
 * Returns true when a navigation is underway, in which case we skip mounting
 * entirely rather than flashing the English app for an instant first.
 */
const redirectToStoredLocale = (): boolean => {
  try {
    if (detectLanguage(window.location.pathname) !== "en") return false;
    if (window.localStorage.getItem("rostory_lang") !== "ro") return false;
    const { pathname, search, hash } = window.location;
    window.location.replace(localizedPath("ro", pathname) + search + hash);
    return true;
  } catch {
    // localStorage unavailable (private mode / browser policy) — just render.
    return false;
  }
};

const mount = () => {
  // The URL is the source of truth for language: English at the bare path,
  // Romanian under /ro (see lib/locale.ts). Resolved once, before the app
  // mounts, and handed to the Router as a basename — which is what makes every
  // existing <Link to="/map"> resolve to /ro/map on the Romanian side without
  // touching a single call site.
  const language = detectLanguage(window.location.pathname);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter basename={basenameFor(language)}>
        <LanguageProvider language={language}>
          <AuthProvider>
            <FavoritesProvider>
              {/* framer-motion is deliberately NOT imported here. Importing it
                  at the entry point put the whole library (~41 kB gzipped) in
                  the eager bundle for every visitor, including the many routes
                  that never animate anything. The four pages that do use it
                  (Auth, AuthCallback, Map, Profile) are lazy-loaded and each
                  wrap themselves in <ReducedMotionConfig>, so the library now
                  loads only with those chunks. CSS-driven motion honors
                  prefers-reduced-motion via the media query in index.css. */}
              <App />
              <Toaster />
              {/* Vercel Web Analytics. Cookieless and no consent banner
                  needed — it stores nothing on the device and records no
                  personal data, so it sits outside GDPR consent
                  requirements, unlike Google Analytics.

                  No CSP change: in production the package injects
                  /_vercel/insights/script.js and beacons to
                  /_vercel/insights/event, both same-origin and therefore
                  already covered by script-src / connect-src 'self'. Only
                  the dev build reaches va.vercel-scripts.com, and localhost
                  is not served the vercel.json CSP at all.

                  Route reporting uses window.location.pathname, which keeps
                  the /ro prefix — so English and Romanian traffic show up as
                  separate routes, which is exactly what we want to measure
                  after putting the locale in the URL. */}
              <Analytics />
            </FavoritesProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
};

if (!redirectToStoredLocale()) {
  mount();
}
