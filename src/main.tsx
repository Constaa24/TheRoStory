import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
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
            {/* reducedMotion="user" makes framer-motion honor the OS
                prefers-reduced-motion setting (map zoom, page transitions
                jump to their end state instead of animating). */}
            <MotionConfig reducedMotion="user">
              <App />
              <Toaster />
            </MotionConfig>
          </FavoritesProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
