/**
 * Subtitles for the films: reading what an author uploads (.srt or .vtt),
 * storing it as WebVTT, and turning it back into cues for the transcript.
 *
 * Why convert instead of storing what was uploaded: browsers only play
 * WebVTT in a <track>, while most tools (Whisper, CapCut, Premiere,
 * Subtitle Edit) export SRT by default. The two differ in a header line and
 * a comma, so the editor converts on the way in and storage only ever holds
 * one format.
 *
 * Kept free of React and Supabase so it can be unit-tested on its own.
 */

export type Cue = {
  /** Seconds. */
  start: number;
  end: number;
  /** Plain text: tags removed, lines joined with "\n". */
  text: string;
  /** From a WebVTT voice tag, `<v Ana>…</v>`, when the file names speakers. */
  speaker?: string;
};

/** A subtitle file is text; a 60-minute film is ~100 KB of it. */
export const MAX_SUBTITLE_BYTES = 512 * 1024;
const MAX_CUES = 5000;

const TIMESTAMP = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
const TIMING_LINE = new RegExp(`^\\s*${TIMESTAMP.source}\\s*-->\\s*${TIMESTAMP.source}`);

const toSeconds = (h: string | undefined, m: string, s: string, ms: string) =>
  Number(h || 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;

const normalizeNewlines = (text: string) => text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

/**
 * SRT to WebVTT. Each SRT block is "index / timing / text"; WebVTT wants a
 * header, a full stop before the milliseconds, and treats the index as an
 * optional cue identifier, so it can stay.
 */
export const srtToVtt = (srt: string): string => {
  const body = normalizeNewlines(srt)
    .trim()
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, "$1.$2");
  return `WEBVTT\n\n${body}\n`;
};

/**
 * Cues from WebVTT (or from SRT, which parses the same once a timing line
 * is found). Skips the header, NOTE, STYLE and REGION blocks; drops cue
 * settings and markup; keeps the speaker from a voice tag.
 */
export const parseVtt = (input: string): Cue[] => {
  const blocks = normalizeNewlines(input).split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((l) => TIMING_LINE.test(l));
    if (timingIndex === -1) continue; // header, NOTE, STYLE, REGION
    const m = TIMING_LINE.exec(lines[timingIndex])!;
    const start = toSeconds(m[1], m[2], m[3], m[4]);
    const end = toSeconds(m[5], m[6], m[7], m[8]);
    const raw = lines.slice(timingIndex + 1).join("\n").trim();
    if (!raw || !(end > start)) continue;
    const voice = /<v(?:\.[^\s>]*)?\s+([^>]+)>/.exec(raw);
    const text = raw
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (!text) continue;
    cues.push({ start, end, text, ...(voice ? { speaker: voice[1].trim() } : {}) });
    if (cues.length > MAX_CUES) break;
  }
  return cues.sort((a, b) => a.start - b.start);
};

export type PreparedSubtitles = { vtt: string; cues: number; lastEnd: number };

/**
 * What the editor uploads: any .srt or .vtt the author picked, checked and
 * converted to WebVTT. Throws a message meant for the author.
 */
export const prepareSubtitleFile = (text: string, fileName: string, language: "en" | "ro"): PreparedSubtitles => {
  const en = language === "en";
  const name = fileName.toLowerCase();
  if (!name.endsWith(".srt") && !name.endsWith(".vtt")) {
    throw new Error(en ? "Choose an .srt or .vtt subtitle file." : "Alege un fișier de subtitrare .srt sau .vtt.");
  }
  if (new Blob([text]).size > MAX_SUBTITLE_BYTES) {
    throw new Error(en ? "That subtitle file is over 512 KB — is it really subtitles?" : "Fișierul de subtitrare depășește 512 KB — sigur e o subtitrare?");
  }
  const clean = normalizeNewlines(text);
  const isVtt = /^WEBVTT/.test(clean.trimStart());
  const vtt = isVtt ? `${clean.trim()}\n` : srtToVtt(clean);
  const cues = parseVtt(vtt);
  if (cues.length === 0) {
    throw new Error(en
      ? "No subtitles found in that file. Each line needs a timing like 00:00:01,000 --> 00:00:04,000."
      : "Nu am găsit subtitrări în fișier. Fiecare replică are nevoie de un interval ca 00:00:01,000 --> 00:00:04,000.");
  }
  if (cues.length > MAX_CUES) {
    throw new Error(en ? `More than ${MAX_CUES} lines — is this the right file?` : `Peste ${MAX_CUES} de replici — e fișierul potrivit?`);
  }
  return { vtt, cues: cues.length, lastEnd: cues[cues.length - 1].end };
};

/** The cue playing at `time`, if any. */
export const cueAt = (cues: Cue[], time: number): number => {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= time) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found !== -1 && time < cues[found].end ? found : -1;
};

/** "1:05", "12:40", "1:02:03". */
export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** "1:05" or "65" or "1:02:03" to seconds; null when it isn't a time. */
export const parseClock = (value: string): number | null => {
  const v = value.trim();
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(v)) return null;
  const parts = v.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((total, p) => total * 60 + p, 0);
};
