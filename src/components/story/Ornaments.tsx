import React from "react";
import { cn } from "@/lib/utils";

/**
 * The storybook's ornaments (styles/storybook.css). All decorative: hidden
 * from assistive tech, never the only carrier of meaning.
 */

type Styled = { className?: string; style?: React.CSSProperties };

/** A stitched gold line — the storybook's replacement for a hairline rule. */
export const Thread: React.FC<Styled> = ({ className, style }) => (
  <span aria-hidden="true" className={cn("sb-thread block", className)} style={style} />
);

/** A cross-stitch knot: the thread's full stop. */
export const Knot: React.FC<Styled & { small?: boolean }> = ({ small, className, style }) => (
  <span aria-hidden="true" className={cn("sb-knot", small && "sb-knot-sm", className)} style={style} />
);

/** Thread, knot, thread. */
export const Divider: React.FC<Styled & { small?: boolean }> = ({ small, className, style }) => (
  <div aria-hidden="true" className={cn("sb-divider", className)} style={style}>
    <span className="sb-thread" />
    <span className={cn("sb-knot", small && "sb-knot-sm")} />
    <span className="sb-thread" />
  </div>
);

/** A band of Romanian cross-stitch, opening or closing a section. */
export const Motif: React.FC<Styled> = ({ className, style }) => (
  <div aria-hidden="true" className={cn("sb-motif", className)} style={style} />
);

/** The eight-pointed rosette: chapter heads and "The end". */
export const Rosette: React.FC<Styled & { size?: "sm" | "md" | "lg" }> = ({ size = "md", className, style }) => (
  <span
    aria-hidden="true"
    className={cn("sb-rosette", size === "sm" && "sb-rosette-sm", size === "lg" && "sb-rosette-lg", className)}
    style={style}
  />
);

/**
 * A centred section opening: rosette, an italic caption and the heading —
 * the storybook's "chapter head" in place of an eyebrow over a title.
 */
export const ChapterHead: React.FC<{
  kicker?: React.ReactNode;
  title: React.ReactNode;
  as?: "h1" | "h2";
  size?: "h1" | "h2";
  rosette?: boolean;
  rosetteSize?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
  id?: string;
}> = ({ kicker, title, as = "h2", size, rosette = true, rosetteSize, children, className, id }) => {
  const Heading = as;
  return (
    <div className={cn("sb-chapter-head", className)}>
      {rosette && <Rosette size={rosetteSize} />}
      {kicker && <p className="sb-kicker">{kicker}</p>}
      <Heading id={id} className={(size ?? as) === "h1" ? "sb-h1" : "sb-h2"} style={{ whiteSpace: "pre-line" }}>
        {title}
      </Heading>
      {children}
    </div>
  );
};

/**
 * Waiting for a page or its data: the rosette, turning slowly (still, for
 * readers who ask for reduced motion). The words are for screen readers.
 */
export const StoryLoading: React.FC<{ language: "en" | "ro"; className?: string; style?: React.CSSProperties }> = ({ language, className, style }) => (
  <div role="status" className={cn("flex justify-center", className)} style={style}>
    <span aria-hidden="true" className="sb-rosette sb-rosette-lg sb-rosette-turn" />
    <span className="sr-only">{language === "en" ? "Loading…" : "Se încarcă…"}</span>
  </div>
);

/** The closing mark of every story. */
export const TheEnd: React.FC<{ language: "en" | "ro"; children?: React.ReactNode }> = ({ language, children }) => (
  <div className="sb-chapter-head" style={{ gap: 12 }}>
    <Rosette size="lg" />
    <p className="sb-h3" style={{ fontSize: 32 }}>{language === "en" ? "The end" : "Sfârșit"}</p>
    {children}
  </div>
);
