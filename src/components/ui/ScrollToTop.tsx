import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      <Button
        onClick={scrollToTop}
        size="icon"
        tabIndex={isVisible ? 0 : -1}
        aria-hidden={!isVisible}
        className={cn(
          'h-12 w-12 rounded-full shadow-elegant bg-accent text-white hover:bg-accent/90 border border-white/20',
          'group transition-all duration-300 hover:scale-110 active:scale-95'
        )}
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-6 w-6 group-hover:-translate-y-1 transition-transform" />
      </Button>
    </div>
  );
};
