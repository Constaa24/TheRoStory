import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export const PaperOverlay: React.FC = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 5000], [0, 50]);
  const y2 = useTransform(scrollY, [0, 5000], [0, -30]);

  return (
    <>
      <div className="grainy-overlay" />
      <motion.div 
        style={{ y: y1 }}
        className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/beige-paper.png')]" 
      />
      <motion.div 
        style={{ y: y2 }}
        className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]" 
      />
    </>
  );
};

