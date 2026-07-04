import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImage, formatBytes } from "@/lib/image";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  tenantId: string;
  prefix: string;
  bucket?: string;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  previewClassName?: string;
  hint?: string;
};

/**
 * File upload for tenant branding images (logo / hero).
 * Compresses in the browser then uploads to Supabase Storage and writes the
 * public URL back to `onChange`. A URL input is kept as a fallback.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  tenantId,
  prefix,
  bucket = "tenant-logos",
  maxSizeMB = 0.5,
  maxWidthOrHeight = 1600,
  previewClassName = "h-20 w-20 rounded-xl object-cover border",
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    try {
      setUploading(true);
      const before = file.size;
      const compressed = await compressImage(file, { maxSizeMB, maxWidthOrHeight });
      const ext = (compressed.type.split("/")[1] || "webp").toLowerCase();
      const path = `${tenantId}/${prefix}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, compressed, { upsert: true, contentType: compressed.type, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success(`تم الرفع (${formatBytes(before)} → ${formatBytes(compressed.size)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفع");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <img src={value} alt="preview" className={previewClassName} loading="lazy" decoding="async" />
        ) : (
          <div className={`${previewClassName} bg-muted/40 flex items-center justify-center text-xs text-muted-foreground`}>
            بدون صورة
          </div>
        )}
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-4 h-4 ml-1" />
              {uploading ? "جارٍ الرفع..." : "اختر صورة"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="text-xs"
          />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
