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

export const HeroBanner: React.FC<HeroBannerProps> = ({ 
  title, 
  subtitle, 
  imageUrl, 
  Icon,
  height = "h-[60vh]"
}) => {
  return (
    <section className={`relative ${height} flex items-center justify-center overflow-hidden`}>
      <div
        role="img"
        aria-label={title}
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
        style={{
          backgroundImage: `url("${imageUrl}")`,
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>
      
      <div className="relative z-10 text-center space-y-6 px-4 max-w-4xl">
        {Icon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-4"
          >
            <div className="bg-white/20 backdrop-blur-md rounded-full p-4 border border-white/30">
              <Icon className="h-10 w-10 text-white" />
            </div>
          </motion.div>
        )}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-serif font-black text-white tracking-tight px-4 pb-2"
        >
          {title}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-white/90 font-serif italic max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>
      </div>
    </section>
  );
};
