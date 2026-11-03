import { describe, expect, it } from 'vitest';
import { cueAt, formatClock, parseClock, parseVtt, prepareSubtitleFile, srtToVtt } from './subtitles';

const SRT = `1
00:00:01,000 --> 00:00:04,250
Long before history was written,
they rode the storms.

2
00:00:05,500 --> 00:00:07,000
<i>Who goes there?</i>
`;

describe('srtToVtt', () => {
  it('adds the header and swaps the millisecond comma', () => {
    const vtt = srtToVtt(SRT);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:04.250');
    expect(vtt).not.toMatch(/\d,\d{3}/);
  });

  it('copes with Windows line endings and a byte-order mark', () => {
    const vtt = srtToVtt('\uFEFF' + SRT.replace(/\n/g, '\r\n'));
    expect(parseVtt(vtt)).toHaveLength(2);
  });
});

describe('parseVtt', () => {
  it('reads cues, dropping markup, settings, notes and styles', () => {
    const cues = parseVtt(`WEBVTT

NOTE made with Whisper

STYLE
::cue { color: red }

intro
00:01.000 --> 00:04.250 align:start line:-2
Long before history was written,
they rode the storms.

00:00:05.500 --> 00:00:07.000
<v Ana><i>Who goes</i> there?</v>
`);
    expect(cues).toEqual([
      { start: 1, end: 4.25, text: 'Long before history was written,\nthey rode the storms.' },
      { start: 5.5, end: 7, text: 'Who goes there?', speaker: 'Ana' },
    ]);
  });

  it('reads hours, and decodes entities', () => {
    const [cue] = parseVtt('WEBVTT\n\n01:02:03.5 --> 01:02:05.000\nTom &amp; Ana');
    expect(cue.start).toBeCloseTo(3723.5);
    expect(cue.text).toBe('Tom & Ana');
  });

  it('skips empty and backwards cues, and sorts the rest', () => {
    const cues = parseVtt('WEBVTT\n\n00:09.000 --> 00:10.000\nlater\n\n00:05.000 --> 00:04.000\nbackwards\n\n00:06.000 --> 00:07.000\n\n00:01.000 --> 00:02.000\nfirst');
    expect(cues.map((c) => c.text)).toEqual(['first', 'later']);
  });
});

describe('prepareSubtitleFile', () => {
  it('converts an .srt and counts its lines', () => {
    const out = prepareSubtitleFile(SRT, 'Film.EN.srt', 'en');
    expect(out.vtt.startsWith('WEBVTT')).toBe(true);
    expect(out.cues).toBe(2);
    expect(out.lastEnd).toBe(7);
  });

  it('keeps a .vtt as it is', () => {
    const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\nHello\n';
    expect(prepareSubtitleFile(vtt, 'a.vtt', 'en').vtt).toBe(vtt);
  });

  it('refuses other files, empty files and huge files, in the editor language', () => {
    expect(() => prepareSubtitleFile(SRT, 'film.txt', 'en')).toThrow(/\.srt or \.vtt/);
    expect(() => prepareSubtitleFile('just some words', 'a.srt', 'ro')).toThrow(/Nu am găsit/);
    expect(() => prepareSubtitleFile('x'.repeat(600 * 1024), 'a.srt', 'en')).toThrow(/512 KB/);
  });
});

describe('cueAt', () => {
  const cues = parseVtt(srtToVtt(SRT));
  it('finds the cue on screen, and none in the gaps', () => {
    expect(cueAt(cues, 0.5)).toBe(-1);
    expect(cueAt(cues, 1)).toBe(0);
    expect(cueAt(cues, 4.2)).toBe(0);
    expect(cueAt(cues, 4.25)).toBe(-1);
    expect(cueAt(cues, 6)).toBe(1);
    expect(cueAt(cues, 99)).toBe(-1);
    expect(cueAt([], 3)).toBe(-1);
  });
});

describe('clock times', () => {
  it('formats and parses the times authors type', () => {
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(parseClock('1:05')).toBe(65);
    expect(parseClock('65')).toBe(65);
    expect(parseClock(' 1:02:03 ')).toBe(3723);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('one')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});
