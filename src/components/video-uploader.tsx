import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { initVideoUpload, signVideoPart, completeVideoUpload, abortVideoUpload } from "@/lib/video.functions";

const PART_SIZE = 8 * 1024 * 1024; // 8 MB
const CONCURRENCY = 3;

type Props = {
  tenantId: string;
  onUploaded?: (assetId: string) => void;
};

export function VideoUploader({ tenantId, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const aborted = useRef(false);
  const currentAsset = useRef<string | null>(null);

  const initFn = useServerFn(initVideoUpload);
  const signFn = useServerFn(signVideoPart);
  const completeFn = useServerFn(completeVideoUpload);
  const abortFn = useServerFn(abortVideoUpload);

  async function handleFile(file: File) {
    setUploading(true);
    setProgress(0);
    setFilename(file.name);
    aborted.current = false;
    try {
      const { assetId } = await initFn({
        data: { tenantId, filename: file.name, mimeType: file.type || "video/mp4", sizeBytes: file.size },
      });
      currentAsset.current = assetId;

      const totalParts = Math.ceil(file.size / PART_SIZE);
      const partsDone: { partNumber: number; etag: string }[] = [];
      let uploadedBytes = 0;

      // Upload parts with a small concurrency pool
      let cursor = 0;
      async function worker() {
        while (!aborted.current) {
          const partNumber = ++cursor;
          if (partNumber > totalParts) return;
          const start = (partNumber - 1) * PART_SIZE;
          const end = Math.min(start + PART_SIZE, file.size);
          const blob = file.slice(start, end);
          const { url } = await signFn({ data: { assetId, partNumber } });
          const res = await fetch(url, { method: "PUT", body: blob });
          if (!res.ok) throw new Error(`Part ${partNumber} failed: ${res.status}`);
          const etag = (res.headers.get("ETag") ?? res.headers.get("etag") ?? "").replace(/"/g, "");
          partsDone.push({ partNumber, etag: `"${etag}"` });
          uploadedBytes += end - start;
          setProgress(Math.round((uploadedBytes / file.size) * 100));
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalParts) }, worker));
      if (aborted.current) throw new Error("aborted");

      await completeFn({ data: { assetId, parts: partsDone } });
      toast.success("تم رفع الفيديو");
      onUploaded?.(assetId);
      currentAsset.current = null;
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "فشل الرفع");
      if (currentAsset.current) {
        await abortFn({ data: { assetId: currentAsset.current } }).catch(() => null);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function cancel() {
    aborted.current = true;
  }

  return (
    <div className="space-y-2 border rounded-lg p-4" dir="rtl">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {!uploading ? (
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 ml-2" /> اختر ملف فيديو
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate max-w-[60%]">{filename}</span>
            <div className="flex items-center gap-2">
              <span>{progress}%</span>
              <Button size="sm" variant="ghost" onClick={cancel}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <Progress value={progress} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">يُرفَع الفيديو مباشرةً إلى Cloudflare R2 (multipart)</p>
    </div>
  );
}
