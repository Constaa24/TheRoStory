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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <FavoritesProvider>
            <App />
            <Toaster />
          </FavoritesProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
