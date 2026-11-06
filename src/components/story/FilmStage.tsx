import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Maximize2, Volume2, VolumeX, Captions, CaptionsOff } from "lucide-react";
import type { Article } from "@/lib/supabase";
import { storageImage } from "@/lib/image-url";
import { toneFor } from "@/lib/article-utils";
import { CaptionOverlay, ReadAlong, chapterIndexAt, chapterTitle, useActiveCue, useFilmSubtitles } from "@/components/story/FilmReadAlong";
import type { Cue } from "@/lib/subtitles";

type Lang = "en" | "ro";

/** One shared empty list, so a film without subtitles doesn't hand the
 * cue tracker a new array, and new listeners, on every render. */
const NO_CUES: Cue[] = [];

/**
 * The film in its frame (the redesign's StoryPage, film): the player, its
 * own captions and chapter marks, then the chapters and the words of the
 * film to read along. The page around it (title, text, margin) is the
 * story page's; the film's length is handed up for the facts beside the
 * title, since it is only known once the video's metadata loads.
 */
export const FilmStage: React.FC<{ article: Article; language: Lang; onDuration?: (seconds: number) => void }> = ({ article, language, onDuration }) => {
  // A poster can't take a srcset, so its size is chosen once: phones get
  // the 800px rendition instead of the 1600px one (~250 KB saved).
  const [posterSurface] = useState<'card' | 'feature'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches ? 'card' : 'feature'
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  // Hover-close grace period: the popup sits a few px above the button, so
  // the cursor briefly leaves the container while crossing the gap. Without
  // a delay, mouseleave fires and the slider snaps shut before the user
  // reaches it. The timer is canceled if mouseenter fires again (popup or
  // button).
  const hideTimerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  // Touch devices don't fire hover events, so the slider needs a tap to open
  // and an outside-tap (or second tap) to close. Detect once and adapt.
  const [isTouch, setIsTouch] = useState(false);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [article.mediaUrl]);

  // Auto-hiding player chrome: while playing, the controls fade out after a
  // few idle seconds and reappear on mouse movement, so they don't sit over
  // the film. While paused they always stay visible.
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<number | null>(null);
  const CONTROLS_IDLE_MS = 2800;

  const clearControlsTimer = () => {
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  };

  // Show the chrome and, if playing, restart the idle countdown. `delay`
  // lets mouseleave hide a touch quicker than an idle timeout.
  const revealControls = (hideAfter: number = CONTROLS_IDLE_MS) => {
    setControlsVisible(true);
    clearControlsTimer();
    if (playing) {
      controlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsTimerRef.current = null;
      }, hideAfter);
    }
  };

  // Pause → always show; play → start the idle countdown.
  useEffect(() => {
    if (!playing) {
      clearControlsTimer();
      setControlsVisible(true);
      return;
    }
    clearControlsTimer();
    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsTimerRef.current = null;
    }, CONTROLS_IDLE_MS);
  }, [playing]);

  useEffect(() => () => clearControlsTimer(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(hover: none)');
    setIsTouch(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // On touch devices the slider opens on tap; close it when the user taps
  // anywhere outside the volume cluster.
  useEffect(() => {
    if (!showVolume || !isTouch) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!volumeContainerRef.current?.contains(e.target as Node)) {
        setShowVolume(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showVolume, isTouch]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const fullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    // iOS Safari doesn't expose the standard Fullscreen API on arbitrary
    // elements; the video element ships its own `webkitEnterFullscreen`.
    // Try the standard path first, then fall back through the vendor APIs.
    const vAny = v as HTMLVideoElement & {
      webkitRequestFullscreen?: () => void;
      webkitEnterFullscreen?: () => void;
    };
    const enterIOS = () => {
      if (typeof vAny.webkitEnterFullscreen === 'function') {
        try { vAny.webkitEnterFullscreen(); } catch { /* ignore */ }
      }
    };
    if (typeof v.requestFullscreen === 'function') {
      v.requestFullscreen().catch(enterIOS);
      return;
    }
    if (typeof vAny.webkitRequestFullscreen === 'function') {
      vAny.webkitRequestFullscreen();
      return;
    }
    enterIOS();
  };

  const handleVolumeButtonClick = () => {
    // Desktop keeps the quick mute-toggle on click (hover already exposes
    // the slider). Touch has no hover, so tapping the button opens/closes
    // the slider — that's how the user scales volume on mobile.
    if (isTouch) {
      setShowVolume(prev => !prev);
    } else {
      toggleMute();
    }
  };

  const cancelVolumeHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleVolumeMouseEnter = () => {
    cancelVolumeHide();
    setShowVolume(true);
  };

  const handleVolumeMouseLeave = () => {
    cancelVolumeHide();
    hideTimerRef.current = window.setTimeout(() => {
      setShowVolume(false);
      hideTimerRef.current = null;
    }, 200);
  };

  useEffect(() => () => cancelVolumeHide(), []);

  // Progress-bar scrubbing. Pointer events + pointer capture let the user
  // click AND drag the playhead, and keep tracking even when the cursor
  // leaves the (thin) bar. touch-action:none on the bar stops the page from
  // scrolling mid-drag on touch devices.
  const scrubbingRef = useRef(false);

  const seekToClientX = (clientX: number) => {
    const bar = progressBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = pct * duration;
    v.currentTime = t;
    setCurrentTime(t); // immediate feedback; don't wait for the timeupdate event
  };

  const handleScrubStart = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    seekToClientX(e.clientX);
  };
  const handleScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) seekToClientX(e.clientX);
  };
  const handleScrubEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    if (val === 0) { v.muted = true; setMuted(true); }
    else if (v.muted) { v.muted = false; setMuted(false); }
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const en = language === 'en';

  // Subtitles and chapters (migration 20261102140000). Captions are on by
  // default in the page's language, or the other one when that's all there
  // is: the films are narrated, so a reader of the other language needs them.
  const subtitles = useFilmSubtitles(article);
  const subLanguages = (['en', 'ro'] as const).filter((l) => subtitles[l]);
  const [subLangChoice, setSubLangChoice] = useState<'en' | 'ro' | null>(null);
  const subLang: 'en' | 'ro' = subLangChoice && subtitles[subLangChoice] ? subLangChoice : (subtitles[language] ? language : subLanguages[0] ?? language);
  const cues = subtitles[subLang]?.cues ?? NO_CUES;
  const [captionsOn, setCaptionsOn] = useState(true);
  const activeCue = useActiveCue(videoRef, cues);
  const chapters = useMemo(() => [...(article.filmChapters ?? [])].sort((a, b) => a.t - b.t), [article.filmChapters]);
  const chapterIndex = chapterIndexAt(chapters, currentTime);
  const currentChapter = chapterTitle(chapters[chapterIndex], language);

  // In full screen the browser shows only the <video>, so the page's caption
  // layer can't follow it there; the matching <track> takes over instead.
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onChange = () => setVideoFullscreen(document.fullscreenElement === v);
    const onBegin = () => setVideoFullscreen(true);
    const onEnd = () => setVideoFullscreen(false);
    document.addEventListener('fullscreenchange', onChange);
    v.addEventListener('webkitbeginfullscreen', onBegin);
    v.addEventListener('webkitendfullscreen', onEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      v.removeEventListener('webkitbeginfullscreen', onBegin);
      v.removeEventListener('webkitendfullscreen', onEnd);
    };
  }, [article.mediaUrl]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    for (const track of Array.from(v.textTracks)) {
      track.mode = videoFullscreen && captionsOn && track.language === subLang ? 'showing' : 'disabled';
    }
  }, [videoFullscreen, captionsOn, subLang, subtitles]);

  const seekTo = (time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
    setCurrentTime(time);
    if (v.paused) v.play().catch(() => { /* autoplay refused: the reader presses play */ });
  };

  useEffect(() => {
    if (duration > 0) onDuration?.(duration);
  }, [duration, onDuration]);

  return (
    <section className="ed-container">
        <div
          className="video-frame"
          style={{ aspectRatio: '16/9', borderRadius: 28, background: '#0d0b08', border: '1px solid var(--line)' }}
          onMouseMove={() => revealControls()}
          onMouseLeave={() => revealControls(500)}
        >
          {article.mediaUrl ? (
            <>
              <video
                ref={videoRef}
                src={article.mediaUrl}
                poster={storageImage(article.posterUrl, posterSurface)}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ cursor: controlsVisible ? 'pointer' : 'none' }}
                playsInline
                onClick={togglePlay}
              >
                {subLanguages.map((l) => (
                  <track key={l} kind="subtitles" srcLang={l} label={l === 'en' ? 'English' : 'Română'} src={subtitles[l]!.src} />
                ))}
              </video>
              {captionsOn && (
                <CaptionOverlay cue={activeCue >= 0 ? cues[activeCue] : undefined} lifted={controlsVisible} lang={subLang} />
              )}
              {/* On a phone the player is ~175 px tall, so the round button
                  is smaller and sits above the control bar rather than
                  crowding it. */}
              {!playing && (
                <button
                  type="button"
                  className="absolute inset-0 grid place-items-center cursor-pointer pb-12 sm:pb-0"
                  style={{ background: 'linear-gradient(180deg, rgba(13,11,8,0.1) 40%, rgba(13,11,8,0.7) 100%)', border: 0 }}
                  onClick={togglePlay}
                  aria-label={en ? 'Play the film' : 'Pornește filmul'}
                >
                  <span className="grid place-items-center transition-transform hover:scale-105" style={{ width: 'clamp(60px, 9vw, 104px)', height: 'clamp(60px, 9vw, 104px)', borderRadius: '50%', border: '1px solid rgba(217, 191, 140, 0.8)', background: 'rgba(13, 11, 8, 0.55)', color: '#d9bf8c' }}>
                    <Play className="w-8 h-8" fill="currentColor" aria-hidden="true" />
                  </span>
                </button>
              )}
              {/* Player chrome — fades out while playing + idle. onFocus/
                  onBlur keep it visible while a keyboard user is tabbing
                  through it (mousemove can't reveal it for them), then
                  resume auto-hide once focus leaves. */}
              <div
                className="absolute left-0 right-0 bottom-0 px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4"
                style={{
                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
                  color: '#f4ead7',
                  opacity: controlsVisible ? 1 : 0,
                  pointerEvents: controlsVisible ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease',
                }}
                onFocus={() => { setControlsVisible(true); clearControlsTimer(); }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) revealControls();
                }}
              >
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-9 h-9 grid place-items-center cursor-pointer"
                  style={{ background: 'transparent', border: 0, color: 'inherit' }}
                  aria-label={playing ? (en ? 'Pause' : 'Pauză') : (en ? 'Play' : 'Pornește')}
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="currentColor" />}
                </button>
                <div className="font-ui text-[13px] font-semibold whitespace-nowrap">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                {currentChapter && (
                  <div className="hidden md:block font-display italic text-[16px] truncate max-w-[200px]" style={{ color: '#d9bf8c' }}>
                    {currentChapter}
                  </div>
                )}
                <div
                  ref={progressBarRef}
                  className="flex-1 h-1.5 rounded-full relative cursor-pointer group after:content-[''] after:absolute after:inset-x-0 after:-inset-y-3"
                  style={{ background: 'rgba(244, 234, 215, 0.25)', touchAction: 'none' }}
                  onPointerDown={handleScrubStart}
                  onPointerMove={handleScrubMove}
                  onPointerUp={handleScrubEnd}
                  onPointerCancel={handleScrubEnd}
                  role="slider"
                  aria-label={en ? 'Seek' : 'Derulează'}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration) || 0}
                  aria-valuenow={Math.round(currentTime) || 0}
                  aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}${currentChapter ? ` · ${currentChapter}` : ''}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    const v = videoRef.current;
                    if (!v || !duration) return;
                    // Arrow keys nudge ±5s for keyboard users.
                    if (e.key === 'ArrowRight') { e.preventDefault(); v.currentTime = Math.min(duration, v.currentTime + 5); setCurrentTime(v.currentTime); }
                    else if (e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); setCurrentTime(v.currentTime); }
                    // PageDown / PageUp: the next chapter, or back to the start of
                    // this one (then the previous, if already near its start).
                    else if (e.key === 'PageDown' && chapters.length) {
                      e.preventDefault();
                      const next = chapters.find((c) => c.t > v.currentTime + 0.5);
                      if (next) { v.currentTime = next.t; setCurrentTime(next.t); }
                    } else if (e.key === 'PageUp' && chapters.length) {
                      e.preventDefault();
                      const back = [...chapters].reverse().find((c) => c.t < v.currentTime - 2);
                      const t = back ? back.t : 0;
                      v.currentTime = t; setCurrentTime(t);
                    }
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-100" style={{ width: progressPct + '%', background: '#c9a96e' }} />
                  {duration > 0 && chapters.filter((c) => c.t > 0 && c.t < duration).map((c) => (
                    <span
                      key={c.t}
                      aria-hidden="true"
                      className="absolute top-0 bottom-0"
                      style={{ left: `${(c.t / duration) * 100}%`, width: 3, marginLeft: -1.5, background: 'rgba(13, 11, 8, 0.9)' }}
                    />
                  ))}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPct}% - 6px)`, background: '#c9a96e', boxShadow: '0 0 4px rgba(0,0,0,0.4)' }}
                  />
                </div>
                {/* Volume */}
                <div
                  ref={volumeContainerRef}
                  className="relative"
                  onMouseEnter={isTouch ? undefined : handleVolumeMouseEnter}
                  onMouseLeave={isTouch ? undefined : handleVolumeMouseLeave}
                >
                  <button
                    type="button"
                    onClick={handleVolumeButtonClick}
                    className="w-9 h-9 grid place-items-center cursor-pointer"
                    style={{ background: 'transparent', border: 0, color: 'inherit' }}
                    aria-label={isTouch ? (en ? 'Volume' : 'Volum') : (muted ? (en ? 'Unmute' : 'Pornește sunetul') : (en ? 'Mute' : 'Oprește sunetul'))}
                    aria-expanded={isTouch ? showVolume : undefined}
                  >
                    {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  {showVolume && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-3 rounded-xl flex flex-col items-center gap-2"
                      style={{ background: 'rgba(13,11,8,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(201,169,110,0.3)' }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={muted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="volume-slider"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 4, height: 80, accentColor: '#c9a96e', cursor: 'pointer' }}
                        aria-label={en ? 'Volume' : 'Volum'}
                      />
                      {isTouch && (
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="grid place-items-center cursor-pointer"
                          style={{ background: 'transparent', border: 0, color: 'inherit', padding: 2 }}
                          aria-label={muted ? (en ? 'Unmute' : 'Pornește sunetul') : (en ? 'Mute' : 'Oprește sunetul')}
                        >
                          {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {subLanguages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCaptionsOn((on) => !on)}
                    className="w-9 h-9 grid place-items-center cursor-pointer"
                    style={{ background: 'transparent', border: 0, color: 'inherit' }}
                    aria-pressed={captionsOn}
                    aria-label={en ? 'Subtitles' : 'Subtitrare'}
                    title={captionsOn
                      ? (en ? `Subtitles on (${subLang === 'en' ? 'English' : 'Romanian'})` : `Subtitrare pornită (${subLang === 'en' ? 'engleză' : 'română'})`)
                      : (en ? 'Subtitles off' : 'Subtitrare oprită')}
                  >
                    {captionsOn ? <Captions className="w-5 h-5" /> : <CaptionsOff className="w-5 h-5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={fullscreen}
                  className="w-9 h-9 grid place-items-center cursor-pointer"
                  style={{ background: 'transparent', border: 0, color: 'inherit' }}
                  aria-label={en ? 'Full screen' : 'Ecran complet'}
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="ph w-full h-full" data-tone={toneFor(article.id)} style={{ border: 0 }} />
          )}
        </div>
        {article.mediaUrl && (cues.length > 0 || chapters.length > 0) && (
          <ReadAlong
            cues={cues}
            chapters={chapters}
            active={activeCue}
            playing={playing}
            onSeek={seekTo}
            subLang={subLang}
            languages={subLanguages}
            onSubLang={setSubLangChoice}
            language={language}
            currentChapter={chapterIndex}
          />
        )}
    </section>
  );
};
