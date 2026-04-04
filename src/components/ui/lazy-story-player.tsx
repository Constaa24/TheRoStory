import React, { useEffect, useRef, useState } from "react";
import { StoryPlayer } from "./story-player";
import type { ComponentProps } from "react";

interface LazyStoryPlayerProps extends ComponentProps<typeof StoryPlayer> {
  rootMargin?: string;
}

export const LazyStoryPlayer: React.FC<LazyStoryPlayerProps> = ({
  rootMargin = "200px",
  className,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (!shouldMount) {
    return <div ref={containerRef} className={className} />;
  }

  return <StoryPlayer className={className} {...props} />;
};

export default LazyStoryPlayer;
