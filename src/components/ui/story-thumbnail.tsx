import React from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoryThumbnailProps {
  posterUrl?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

export const StoryThumbnail: React.FC<StoryThumbnailProps> = ({
  posterUrl,
  alt = "",
  className,
  fallbackClassName,
}) => {
  if (!posterUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary/20 text-muted-foreground/40",
          className,
          fallbackClassName
        )}
        aria-hidden="true"
      >
        <Video className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={posterUrl}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
};

export default StoryThumbnail;
