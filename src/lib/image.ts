import imageCompression from "browser-image-compression";

// ----------------- URL transformer (Cloudflare Image Resizing / Supabase render) -----------------

export type ImgFormat = "webp" | "avif" | "auto";
export type OptimizeOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImgFormat;
};

/**
 * Rewrite a Supabase Storage public URL to use the built-in image transformer
 * (/render/image/public/...). Other URLs are returned unchanged.
 */
export function optimizedImage(url: string, opts: OptimizeOptions = {}): string {
  if (!url) return url;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost");
    // Supabase public storage: /storage/v1/object/public/<bucket>/<path>
    const marker = "/storage/v1/object/public/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return url;
    u.pathname = u.pathname.replace(marker, "/storage/v1/render/image/public/");
    if (opts.width) u.searchParams.set("width", String(opts.width));
    if (opts.height) u.searchParams.set("height", String(opts.height));
    if (opts.quality) u.searchParams.set("quality", String(opts.quality));
    if (opts.format && opts.format !== "auto") u.searchParams.set("format", opts.format);
    u.searchParams.set("resize", "cover");
    return u.toString();
  } catch {
    return url;
  }
}

/** Build a srcSet string across the provided widths. */
export function srcSet(url: string, widths: number[], opts: Omit<OptimizeOptions, "width"> = {}): string {
  return widths
    .map((w) => `${optimizedImage(url, { ...opts, width: w })} ${w}w`)
    .join(", ");
}

// ----------------- Client-side compression before upload -----------------

export type CompressOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
};

/**
 * Compress an image in the browser prior to upload. Non-images pass through.
 * If compression fails for any reason, the original file is returned.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: options.maxSizeMB ?? 1,
      maxWidthOrHeight: options.maxWidthOrHeight ?? 1920,
      useWebWorker: options.useWebWorker ?? true,
      fileType: options.fileType,
      initialQuality: 0.82,
    });
    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
