import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';

/**
 * Back-to-top affordance.
 *
 * Animated with plain CSS rather than framer-motion. This component renders
 * on every route from App.tsx, so importing framer-motion here pulled the
 * whole library (~41 kB gzipped) into the eager bundle for a single fade —
 * every visitor paid for it on first paint. The `prefers-reduced-motion`
 * block in index.css neutralizes the transition, which is what MotionConfig
 * was doing for it before.
 *
 * The button stays mounted and toggles visibility so it can transition both
 * in and out; `visibility` (not just opacity) keeps it out of the tab order
 * and away from the pointer while hidden.
 */
export const ScrollToTop: React.FC = () => {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const toggleVisibility = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsVisible(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    };

    toggleVisibility();
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className={cn('scroll-to-top', isVisible && 'is-visible')}>
      <button
        type="button"
        onClick={scrollToTop}
        tabIndex={isVisible ? 0 : -1}
        aria-hidden={!isVisible}
        className={cn('sb-icon-btn group transition-colors')}
        style={{ width: 48, height: 48, background: 'var(--paper)', borderColor: 'var(--gold-deep)', color: 'var(--gold)', boxShadow: 'var(--shadow-soft)' }}
        aria-label={language === 'en' ? 'Scroll to top' : 'Înapoi sus'}
      >
        <ChevronUp className="h-5 w-5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />
      </button>
    </div>
  );
};
