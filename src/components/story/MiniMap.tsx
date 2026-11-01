import React from "react";
import type { Article } from "@/lib/supabase";
import { pinOf } from "@/lib/story-facts";
import { cn } from "@/lib/utils";

type Placed = Pick<Article, "id" | "lat" | "lng" | "location">;

/**
 * Romania's outline (public/atlas/romania.svg, drawn by the stylesheet) with
 * a pin for each story: a solid pin for an exact place, a dashed ring for a
 * story placed only by its county. Stories with neither are left off.
 *
 * Decorative — the place is always also written out beside it.
 */
export const MiniMap: React.FC<{ stories: Placed[]; className?: string; style?: React.CSSProperties }> = ({ stories, className, style }) => (
  <div aria-hidden="true" className={cn("sb-mini-map", className)} style={style}>
    {stories.map((s) => {
      const pin = pinOf(s);
      if (!pin) return null;
      return (
        <span
          key={s.id}
          className={pin.exact ? "sb-mini-pin" : "sb-mini-ring"}
          style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
        />
      );
    })}
  </div>
);
