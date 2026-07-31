import React from "react";
import { MotionConfig } from "framer-motion";

/**
 * Wraps a page's framer-motion animations so they honor the OS
 * "reduce motion" setting (animations jump to their end state instead of
 * playing).
 *
 * This used to live in main.tsx as a single app-wide <MotionConfig>, which
 * meant framer-motion was imported at the entry point and shipped to every
 * visitor on first paint — roughly 41 kB gzipped — even though only four
 * lazy-loaded routes animate anything. Each of those routes now imports this
 * wrapper instead, so the library rides along in their chunks and never
 * reaches readers who only browse the archive.
 *
 * Purely CSS-driven motion elsewhere in the app is covered by the
 * `prefers-reduced-motion` media query in index.css.
 */
export const ReducedMotionConfig: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);
