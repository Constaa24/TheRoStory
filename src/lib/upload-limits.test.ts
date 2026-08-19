import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, asMb } from './supabase';

/**
 * Guards against the two upload-limit bugs this project has actually shipped.
 * Both were silent: nothing crashed, no type was wrong, the build was green,
 * and the number the user saw simply stopped matching the number enforced.
 */

const ROOT = join(__dirname, '..', '..');
const MB = 1024 * 1024;

describe('the caps themselves', () => {
  it('are the values the UI copy and the bucket are built around', () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * MB);
    expect(MAX_VIDEO_BYTES).toBe(150 * MB);
  });

  it('lets video be the larger of the two', () => {
    expect(MAX_VIDEO_BYTES).toBeGreaterThan(MAX_IMAGE_BYTES);
  });

  it('renders as the whole numbers the hints print', () => {
    // Every size hint in the editors is derived through asMb rather than
    // typed as a literal, which is what stopped them drifting again.
    expect(asMb(MAX_IMAGE_BYTES)).toBe(10);
    expect(asMb(MAX_VIDEO_BYTES)).toBe(150);
  });
});

/** Every .ts/.tsx file under src/, recursively. */
const sourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) acc.push(full);
  }
  return acc;
};

describe('no call site may loosen a cap', () => {
  it('every hard-coded maxBytes stays within the global ceiling', () => {
    // VideoStoryCreate.tsx used to pass `maxBytes: 500 * 1024 * 1024`, which
    // silently overrode MAX_VIDEO_BYTES. Lowering the constant to 150 MB
    // therefore did nothing at all at that call site, while the hint beside
    // the field went on advertising the new number. A call site tightening a
    // limit is fine and intended — Profile.tsx caps avatars at 5 MB — but one
    // raising it past the ceiling is the bug.
    const offenders: string[] = [];

    for (const file of sourceFiles(join(ROOT, 'src'))) {
      const src = readFileSync(file, 'utf8');
      const re = /maxBytes:\s*([0-9_]+(?:\s*\*\s*[0-9_]+)*)\s*[,}]/g;
      for (const m of src.matchAll(re)) {
        const bytes = m[1]
          .split('*')
          .map((n) => Number(n.replace(/[\s_]/g, '')))
          .reduce((a, b) => a * b, 1);
        if (bytes > MAX_VIDEO_BYTES) {
          offenders.push(
            `${relative(ROOT, file)} passes ${asMb(bytes)} MB, ceiling is ${asMb(MAX_VIDEO_BYTES)} MB`
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('local Supabase config keeps up with the app', () => {
  it('allows at least what the app is willing to upload', () => {
    // supabase/config.toml sat at 50MiB while production accepted more, so an
    // upload that worked against the deployed project failed against a local
    // stack for reasons no error message explained.
    const toml = readFileSync(join(ROOT, 'supabase', 'config.toml'), 'utf8');

    // The [storage] section's own limit — not the commented-out per-bucket
    // examples further down, which start with '#'.
    const match = toml.match(/^\s*file_size_limit\s*=\s*"(\d+)(MiB|MB|GiB|GB)"/m);
    expect(match, 'no file_size_limit found in supabase/config.toml').not.toBeNull();

    const [, amount, unit] = match!;
    const multiplier = { MiB: MB, MB: 1_000_000, GiB: 1024 * MB, GB: 1_000_000_000 }[unit]!;
    const configured = Number(amount) * multiplier;

    expect(
      configured,
      `config.toml allows ${asMb(configured)} MB but the app uploads up to ${asMb(MAX_VIDEO_BYTES)} MB`
    ).toBeGreaterThanOrEqual(MAX_VIDEO_BYTES);
  });
});
