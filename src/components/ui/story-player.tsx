import React from "react";

interface StoryPlayerProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src" | "poster"> {
  src: string;
  posterUrl?: string | null;
  isActive?: boolean;
}

export const StoryPlayer: React.FC<StoryPlayerProps> = ({
  src,
  posterUrl,
  isActive = false,
  ...props
}) => {
  return (
    <video
      src={src}
      poster={posterUrl || undefined}
      preload={isActive ? "metadata" : "none"}
      playsInline
      muted
      {...props}
    />
  );
};

export default StoryPlayer;
