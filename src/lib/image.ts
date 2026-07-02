/**
 * Supabase Image Transformations helper.
 * Converts a public storage URL into a transformed/render URL for smaller payloads.
 * Non-Supabase URLs are returned unchanged.
 */
export type ImageOpts = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "origin";
  resize?: "cover" | "contain" | "fill";
};

export function optimizedImage(url: string | null | undefined, opts: ImageOpts = {}): string {
  if (!url) return "";
  // Only transform Supabase Storage URLs
  const isSupabase = url.includes("/storage/v1/object/public/");
  if (!isSupabase) return url;

  const transformed = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 75));
  if (opts.format && opts.format !== "origin") params.set("format", opts.format);
  if (opts.resize) params.set("resize", opts.resize);
  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}

/** Build a `srcset` string for responsive images. */
export function srcSet(url: string | null | undefined, widths: number[], opts: Omit<ImageOpts, "width"> = {}): string {
  if (!url) return "";
  return widths.map((w) => `${optimizedImage(url, { ...opts, width: w })} ${w}w`).join(", ");
}
