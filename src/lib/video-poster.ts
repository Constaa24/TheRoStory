const clearVideoSource = (video: HTMLVideoElement) => {
  try {
    video.pause();
  } catch {
    // Ignore cleanup pause errors.
  }

  video.removeAttribute("src");
  video.load();
};

const captureFrameBlob = async (
  video: HTMLVideoElement,
  maxWidth = 960,
  quality = 0.82
): Promise<Blob | null> => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, maxWidth / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
};

export const createVideoPosterImageFile = async (
  videoFile: File,
  fileName?: string
): Promise<File | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (!videoFile.type.startsWith("video/")) return null;

  const objectUrl = URL.createObjectURL(videoFile);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      let settled = false;
      let seekFallbackTimeout: number | undefined;
      let overallTimeout: number | undefined;

      const finish = (value: Blob | null) => {
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

      const handleSeeked = async () => finish(await captureFrameBlob(video));
      const handleError = () => finish(null);

      const handleLoadedData = async () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const targetTime = duration > 0.3 ? Math.min(duration * 0.1, 10) : 0;

        if (targetTime <= 0) {
          finish(await captureFrameBlob(video));
          return;
        }

        video.addEventListener("seeked", handleSeeked, { once: true });
        seekFallbackTimeout = window.setTimeout(async () => {
          finish(await captureFrameBlob(video));
        }, 1200);

        try {
          video.currentTime = targetTime;
        } catch {
          finish(await captureFrameBlob(video));
        }
      };

      overallTimeout = window.setTimeout(() => finish(null), 10000);

      video.addEventListener("loadeddata", handleLoadedData, { once: true });
      video.addEventListener("error", handleError, { once: true });
      video.src = objectUrl;
      video.load();
    });

    if (!blob) return null;

    const defaultName = `${videoFile.name.replace(/\.[^.]+$/, "") || "video"}-poster.jpg`;
    return new File([blob], fileName || defaultName, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

