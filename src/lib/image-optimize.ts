/**
 * Image optimization helpers.
 *
 * Product images may come from three families of hosts:
 *  1. Supabase Storage public URLs (`/storage/v1/object/public/...`) — support
 *     server-side transformations via `/storage/v1/render/image/public/...`.
 *  2. Lovable CDN assets (`/__l5e/assets-v1/...`) — already delivered through
 *     Cloudflare with modern-format negotiation and long-lived caching.
 *  3. Arbitrary external URLs — leave untouched.
 *
 * `productImageSources` returns a `<picture>`-ready set of AVIF/WebP sources
 * when the URL supports it, else `null` (caller should render a plain `<img>`).
 */

export type ImageFormat = "avif" | "webp";

export interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number;
}

function isSupabaseStorage(url: string): boolean {
  return /\/storage\/v1\/object\/public\//.test(url);
}

function toSupabaseRender(url: string, format: ImageFormat, opts: ImageTransform): string {
  const rendered = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  const u = new URL(rendered, "http://x");
  if (opts.width) u.searchParams.set("width", String(opts.width));
  if (opts.height) u.searchParams.set("height", String(opts.height));
  u.searchParams.set("quality", String(opts.quality ?? 78));
  u.searchParams.set("format", format);
  // Preserve original scheme/host by returning path + search when input was relative,
  // otherwise the full URL.
  if (/^https?:\/\//i.test(rendered)) {
    return `${u.origin}${u.pathname}?${u.searchParams.toString()}`;
  }
  return `${u.pathname}?${u.searchParams.toString()}`;
}

export function productImageSources(
  src: string | null | undefined,
  opts: ImageTransform = {},
): { avif: string; webp: string } | null {
  if (!src) return null;
  if (isSupabaseStorage(src)) {
    return {
      avif: toSupabaseRender(src, "avif", opts),
      webp: toSupabaseRender(src, "webp", opts),
    };
  }
  return null;
}
