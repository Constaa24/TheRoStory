import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-8 right-8 z-[100]"
        >
          <Button
            onClick={scrollToTop}
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full shadow-elegant bg-accent text-white hover:bg-accent/90 border border-white/20",
              "group transition-all duration-300 hover:scale-110 active:scale-95"
            )}
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-6 w-6 group-hover:-translate-y-1 transition-transform" />
            
            {/* Subtle parchment-like background overlay */}
            <div className="absolute inset-0 rounded-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/beige-paper.png')]" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
