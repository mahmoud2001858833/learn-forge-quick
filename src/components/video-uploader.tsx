import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { initVideoUpload, completeVideoUpload, abortVideoUpload } from "@/lib/video.functions";

const CONCURRENCY = 3;
const MAX_RETRIES = 3;

type Props = {
  tenantId: string;
  onUploaded?: (assetId: string) => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)} ث`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m} د ${s} ث`;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const res = await fetch(url, { ...init, signal });
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw new Error(`HTTP ${res.status}`);
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch_failed");
}

export function VideoUploader({ tenantId, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [speed, setSpeed] = useState(0); // bytes/sec
  const [eta, setEta] = useState(0); // seconds
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentAsset = useRef<string | null>(null);

  const initFn = useServerFn(initVideoUpload);
  const completeFn = useServerFn(completeVideoUpload);
  const abortFn = useServerFn(abortVideoUpload);

  async function probeMeta(file: File): Promise<{ durationSeconds?: number; width?: number; height?: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = url;
      const cleanup = () => URL.revokeObjectURL(url);
      v.onloadedmetadata = () => {
        const out = {
          durationSeconds: Number.isFinite(v.duration) ? Math.round(v.duration) : undefined,
          width: v.videoWidth || undefined,
          height: v.videoHeight || undefined,
        };
        cleanup();
        resolve(out);
      };
      v.onerror = () => { cleanup(); resolve({}); };
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    setProgress(0);
    setUploaded(0);
    setTotal(file.size);
    setSpeed(0);
    setEta(0);
    setFilename(file.name);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const startedAt = Date.now();
    let uploadedBytes = 0;

    const tick = (delta: number) => {
      uploadedBytes += delta;
      setUploaded(uploadedBytes);
      setProgress(Math.round((uploadedBytes / file.size) * 100));
      const elapsed = (Date.now() - startedAt) / 1000;
      const sp = elapsed > 0 ? uploadedBytes / elapsed : 0;
      setSpeed(sp);
      setEta(sp > 0 ? (file.size - uploadedBytes) / sp : 0);
    };

    try {
      const meta = await probeMeta(file);
      const init = await initFn({
        data: {
          tenantId,
          filename: file.name,
          mimeType: file.type || "video/mp4",
          sizeBytes: file.size,
          ...meta,
        },
      });
      currentAsset.current = init.assetId;
      const { key, workerUrl, mode, partSize } = init;

      if (mode === "single") {
        // ≤100MB → single POST /upload
        const res = await fetchWithRetry(
          `${workerUrl}/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(file.type || "video/mp4")}`,
          { method: "POST", body: file, headers: { "content-type": file.type || "application/octet-stream" } },
          signal,
        );
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        tick(file.size);
      } else {
        // >100MB → multipart (10MB parts, parallel)
        const startRes = await fetchWithRetry(
          `${workerUrl}/upload/start?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(file.type || "video/mp4")}`,
          { method: "POST" },
          signal,
        );
        const { uploadId } = (await startRes.json()) as { uploadId: string };

        const totalParts = Math.ceil(file.size / partSize);
        const parts: { partNumber: number; etag: string }[] = [];
        let cursor = 0;
        const worker = async () => {
          while (!signal.aborted) {
            const partNumber = ++cursor;
            if (partNumber > totalParts) return;
            const start = (partNumber - 1) * partSize;
            const end = Math.min(start + partSize, file.size);
            const blob = file.slice(start, end);
            const res = await fetchWithRetry(
              `${workerUrl}/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
              { method: "PUT", body: blob },
              signal,
            );
            const data = (await res.json()) as { partNumber: number; etag: string };
            parts.push({ partNumber: data.partNumber, etag: data.etag });
            tick(end - start);
          }
        };
        try {
          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalParts) }, worker));
          if (signal.aborted) throw new DOMException("aborted", "AbortError");
          await fetchWithRetry(
            `${workerUrl}/upload/complete`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ key, uploadId, parts }),
            },
            signal,
          );
        } catch (e) {
          // Best-effort abort on the Worker
          fetch(`${workerUrl}/upload/abort`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key, uploadId }),
          }).catch(() => null);
          throw e;
        }
      }

      await completeFn({ data: { assetId: init.assetId } });
      toast.success("تم رفع الفيديو");
      onUploaded?.(init.assetId);
      currentAsset.current = null;
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        toast.message("تم إلغاء الرفع");
      } else {
        toast.error(err.message || "فشل الرفع");
      }
      if (currentAsset.current) {
        await abortFn({ data: { assetId: currentAsset.current } }).catch(() => null);
        currentAsset.current = null;
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function cancel() {
    abortRef.current?.abort();
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
            <span className="truncate max-w-[55%]" title={filename ?? ""}>{filename}</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">{progress}%</span>
              <Button size="sm" variant="ghost" onClick={cancel} title="إلغاء">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatBytes(uploaded)} / {formatBytes(total)}</span>
            <span>{formatBytes(speed)}/ث</span>
            <span>متبقي: {formatEta(eta)}</span>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        يُرفَع الفيديو عبر Cloudflare Worker. الملفات ≤ 100MB تُرفع كملف واحد، والأكبر تُقسَّم تلقائياً إلى أجزاء 10MB.
      </p>
    </div>
  );
}
