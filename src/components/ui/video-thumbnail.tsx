import React, { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";

type VideoThumbnailProps = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src" | "poster"> & {
  src: string;
  posterSrc?: string;
  fallbackClassName?: string;
};

const posterCache = new Map<string, string | null>();
const pendingPosterCache = new Map<string, Promise<string | null>>();

const clearVideoSource = (video: HTMLVideoElement) => {
  try {
    video.pause();
  } catch {
    // Ignore pause errors during cleanup.
  }

  video.removeAttribute("src");
  video.load();
};

const capturePosterFrame = (video: HTMLVideoElement): string | null => {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) return null;

  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
};

const extractPosterFromVideo = async (src: string): Promise<string | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  return new Promise((resolve) => {
    let settled = false;
    let seekFallbackTimeout: number | undefined;
    let overallTimeout: number | undefined;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;

      if (seekFallbackTimeout) window.clearTimeout(seekFallbackTimeout);
      if (overallTimeout) window.clearTimeout(overallTimeout);

      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      clearVideoSource(video);

      resolve(value);
    };

    const handleSeeked = () => finish(capturePosterFrame(video));
    const handleError = () => finish(null);

    const handleLoadedData = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const targetTime = duration > 0.3 ? Math.min(duration * 0.1, 10) : 0;

      if (targetTime <= 0) {
        finish(capturePosterFrame(video));
        return;
      }

      video.addEventListener("seeked", handleSeeked, { once: true });

      seekFallbackTimeout = window.setTimeout(() => {
        finish(capturePosterFrame(video));
      }, 1200);

      try {
        video.currentTime = targetTime;
      } catch {
        finish(capturePosterFrame(video));
      }
    };

    overallTimeout = window.setTimeout(() => finish(null), 10000);

    video.addEventListener("loadeddata", handleLoadedData, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.src = src;
    video.load();
  });
};

const LS_POSTER_PREFIX = "rostory_poster_";
const LS_POSTER_INDEX_KEY = "rostory_poster_index";
const LS_POSTER_MAX = 30;

const getPosterIndex = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_POSTER_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
};

const loadCachedPoster = (src: string): string | null => {
  try {
    return localStorage.getItem(LS_POSTER_PREFIX + src);
  } catch {
    return null;
  }
};

const saveCachedPoster = (src: string, dataUrl: string) => {
  try {
    const index = getPosterIndex();
    // Evict oldest entries when at capacity
    if (index.length >= LS_POSTER_MAX && !index.includes(src)) {
      const evicted = index.splice(0, index.length - LS_POSTER_MAX + 1);
      for (const key of evicted) {
        localStorage.removeItem(LS_POSTER_PREFIX + key);
      }
    }
    // Move src to end (most recently used)
    const updated = index.filter((k) => k !== src).concat(src);
    localStorage.setItem(LS_POSTER_INDEX_KEY, JSON.stringify(updated));
    localStorage.setItem(LS_POSTER_PREFIX + src, dataUrl);
  } catch {
    // Storage full — silently ignore
  }
};

const getPosterForVideo = async (src: string): Promise<string | null> => {
  if (posterCache.has(src)) return posterCache.get(src) ?? null;

  // Check localStorage before generating
  const stored = loadCachedPoster(src);
  if (stored) {
    posterCache.set(src, stored);
    return stored;
  }

  const pending = pendingPosterCache.get(src);
  if (pending) return pending;

  const promise = extractPosterFromVideo(src)
    .then((poster) => {
      posterCache.set(src, poster);
      if (poster) saveCachedPoster(src, poster);
      return poster;
    })
    .finally(() => {
      pendingPosterCache.delete(src);
    });

  pendingPosterCache.set(src, promise);
  return promise;
};

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  src,
  posterSrc,
  className,
  fallbackClassName,
  preload,
  playsInline,
  muted,
  onError,
  ...props
}) => {
  const [poster, setPoster] = useState<string | null>(() => posterSrc ?? posterCache.get(src) ?? null);
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasVideoError(false);
    setPoster(posterSrc ?? posterCache.get(src) ?? null);

    if (posterSrc) {
      return () => {
        isMounted = false;
      };
    }

    void getPosterForVideo(src).then((generatedPoster) => {
      if (!isMounted || !generatedPoster) return;
      setPoster(generatedPoster);
    });

    return () => {
      isMounted = false;
    };
  }, [src, posterSrc]);

  if (hasVideoError) {
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
    <video
      src={src}
      poster={poster || undefined}
      className={className}
      preload={preload ?? "metadata"}
      playsInline={playsInline ?? true}
      muted={muted ?? true}
      onError={(event) => {
        setHasVideoError(true);
        onError?.(event);
      }}
      {...props}
    />
  );
};

export default VideoThumbnail;
