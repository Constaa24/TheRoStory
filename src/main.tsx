import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./hooks/use-auth";
import { FavoritesProvider } from "./hooks/use-favorites";
import { LanguageProvider } from "./hooks/use-language";
import { Toaster } from "@/components/ui/sonner";

import { isAbortError } from "./lib/utils";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
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
          </FavoritesProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
