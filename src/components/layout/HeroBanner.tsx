import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface HeroBannerProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  Icon?: LucideIcon;
  height?: string;
}

// Extracted animation variants matching Home.tsx
const fadeScaleIn = { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } } as const;
const fadeSlideUp30 = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } } as const;
const fadeSlideUp20 = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } } as const;
const heroSubtitleTransition = { delay: 0.2 } as const;

/**
 * Build .avif / .webp counterparts from a base image path. Pages keep passing
 * the .jpg URL (so the fallback still works on every browser) and we serve
 * the smaller variant when the browser supports it.
 */
const deriveImageVariants = (url: string) => {
  const dot = url.lastIndexOf(".");
  if (dot < 0) return { avif: url, webp: url, fallback: url };
  const base = url.slice(0, dot);
  return {
    avif: `${base}.avif`,
    webp: `${base}.webp`,
    fallback: url,
  };
};

export const HeroBanner: React.FC<HeroBannerProps> = ({
  title,
  subtitle,
  imageUrl,
  Icon,
  height = "h-[60vh]",
}) => {
  const variants = deriveImageVariants(imageUrl);
  return (
    <section className={`relative ${height} flex items-center justify-center overflow-hidden`}>
      <div className="absolute inset-0 transition-transform duration-1000 scale-105">
        <picture>
          <source type="image/avif" srcSet={variants.avif} />
          <source type="image/webp" srcSet={variants.webp} />
          {/* The hero image is above-the-fold — load eagerly, with high fetch
              priority so it doesn't get stuck behind lower-priority assets. */}
          <img
            src={variants.fallback}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-20 text-center space-y-6 px-4 pt-24 max-w-4xl mx-auto">
        {Icon && (
          <motion.div
            {...fadeScaleIn}
            className="flex justify-center mb-4"
          >
            <div className="bg-white/20 backdrop-blur-md rounded-full p-4 border border-white/30 shadow-lg">
              <Icon className="h-10 w-10 text-white" />
            </div>
          </motion.div>
        )}
        <motion.h1
          {...fadeSlideUp30}
          className="text-4xl sm:text-5xl md:text-7xl font-serif font-black text-white tracking-tight animate-parchment-reveal px-4 pb-2"
        >
          {title}
        </motion.h1>
        <motion.p
          {...fadeSlideUp20}
          transition={heroSubtitleTransition}
          className="text-lg md:text-xl text-white/90 font-serif italic max-w-2xl mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};
