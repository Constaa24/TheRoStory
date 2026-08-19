import { describe, it, expect } from 'vitest';
import {
  storageImage,
  storageOgImage,
  IMAGE_WIDTHS,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  type ImageSurface,
} from './image-url';

const OBJECT = 'https://abc.supabase.co/storage/v1/object/public/article-media/photo.jpg';
const RENDER = '/storage/v1/render/image/public/';

/** Query params of a transformed URL, as a plain object. */
const params = (url: string | undefined) =>
  Object.fromEntries(new URLSearchParams(url!.split('?')[1]));

describe('storageImage', () => {
  it('routes a storage object through the render endpoint', () => {
    const out = storageImage(OBJECT, 'card')!;
    expect(out).toContain(RENDER);
    expect(out).not.toContain('/storage/v1/object/public/');
  });

  it('always sets resize=contain', () => {
    // Not optional and not the default. Supabase defaults to `cover`, which
    // given a width and no height returns 600x4000 from a 6000x4000 source —
    // every photograph on the site vertically squashed.
    for (const surface of Object.keys(IMAGE_WIDTHS) as ImageSurface[]) {
      expect(params(storageImage(OBJECT, surface)).resize).toBe('contain');
    }
  });

  it('always sets format=webp', () => {
    // The endpoint does not negotiate on Accept. Without this a 10 MB PNG
    // comes back as a 1910 KB PNG instead of a 116 KB WebP, and `quality`
    // barely applies.
    for (const surface of Object.keys(IMAGE_WIDTHS) as ImageSurface[]) {
      expect(params(storageImage(OBJECT, surface)).format).toBe('webp');
    }
  });

  it('requests the width for the surface', () => {
    expect(params(storageImage(OBJECT, 'avatar')).width).toBe('96');
    expect(params(storageImage(OBJECT, 'thumb')).width).toBe('200');
    expect(params(storageImage(OBJECT, 'card')).width).toBe('800');
    expect(params(storageImage(OBJECT, 'feature')).width).toBe('1600');
    expect(params(storageImage(OBJECT, 'hero')).width).toBe('1920');
  });

  it('keeps widths in ascending order of surface size', () => {
    const { avatar, thumb, card, feature, hero } = IMAGE_WIDTHS;
    expect(avatar).toBeLessThan(thumb);
    expect(thumb).toBeLessThan(card);
    expect(card).toBeLessThan(feature);
    expect(feature).toBeLessThan(hero);
  });

  describe('passes through anything that is not a transformable storage object', () => {
    it('local assets', () => {
      // The category artwork and hero images ship from /public.
      expect(storageImage('/categories/cat_history_new.jpg', 'card'))
        .toBe('/categories/cat_history_new.jpg');
      expect(storageImage('/logo.png', 'avatar')).toBe('/logo.png');
    });

    it('Google OAuth avatars', () => {
      const g = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c';
      expect(storageImage(g, 'avatar')).toBe(g);
    });

    it('data and blob URLs, used for local previews before upload', () => {
      const data = 'data:image/png;base64,iVBORw0KGgo=';
      const blob = 'blob:http://localhost:3000/9f8e-1234';
      expect(storageImage(data, 'card')).toBe(data);
      expect(storageImage(blob, 'card')).toBe(blob);
    });

    it('videos, which need the real object URL for range requests', () => {
      for (const ext of ['mp4', 'webm', 'mov', 'm4v', 'ogv']) {
        const v = `https://abc.supabase.co/storage/v1/object/public/article-media/film.${ext}`;
        expect(storageImage(v, 'feature')).toBe(v);
      }
    });

    it('an already-transformed URL, which would otherwise nest the marker and 404', () => {
      const once = storageImage(OBJECT, 'card')!;
      expect(storageImage(once, 'hero')).toBe(once);
    });

    it('nothing at all', () => {
      expect(storageImage(undefined, 'card')).toBeUndefined();
      expect(storageImage(null, 'card')).toBeUndefined();
      expect(storageImage('', 'card')).toBeUndefined();
    });
  });

  it('preserves a query string the caller already had', () => {
    const withToken = `${OBJECT}?t=cachebust123`;
    const out = params(storageImage(withToken, 'card'));
    expect(out.t).toBe('cachebust123');
    expect(out.width).toBe('800');
    expect(out.resize).toBe('contain');
  });
});

describe('storageOgImage', () => {
  it('crops to exactly the dimensions PageHead declares', () => {
    // PageHead advertises og:image:width 1200 and og:image:height 630. If the
    // rendition does not actually match, a platform that trusts those numbers
    // lays the card out wrong.
    const out = params(storageOgImage(OBJECT));
    expect(out.width).toBe(String(OG_IMAGE_WIDTH));
    expect(out.height).toBe(String(OG_IMAGE_HEIGHT));
  });

  it('uses cover, the one place cropping is correct', () => {
    expect(params(storageOgImage(OBJECT)).resize).toBe('cover');
  });

  it('stays in the original format rather than WebP', () => {
    // Share-card scrapers — LinkedIn especially — are not worth betting on
    // WebP support for. The bytes are fetched once per share, not per reader.
    expect(params(storageOgImage(OBJECT)).format).toBe('origin');
  });

  it('is 1.91:1, the aspect every major platform targets', () => {
    expect(OG_IMAGE_WIDTH / OG_IMAGE_HEIGHT).toBeCloseTo(1.905, 2);
  });

  it('passes through non-storage and video URLs like storageImage does', () => {
    expect(storageOgImage('/og-default.jpg')).toBe('/og-default.jpg');
    expect(storageOgImage(undefined)).toBeUndefined();
    const v = 'https://abc.supabase.co/storage/v1/object/public/article-media/film.mp4';
    expect(storageOgImage(v)).toBe(v);
  });
});
