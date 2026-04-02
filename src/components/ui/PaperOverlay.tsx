import React from "react";

export const PaperOverlay: React.FC = () => {
  return (
    <>
      <div className="grainy-overlay" />
      <div className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/beige-paper.png')]" />
      <div className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]" />
    </>
  );
};

