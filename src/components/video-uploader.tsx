import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X, RotateCw } from "lucide-react";
import {
  initVideoUpload,
  completeVideoUpload,
  abortVideoUpload,
  saveUploadId,
  listResumableUploads,
} from "@/lib/video.functions";

const CONCURRENCY = 3;
const MAX_RETRIES = 3;
const LS_KEY = "lovable.video.resume.v1";

type Props = {
  tenantId: string;
  onUploaded?: (assetId: string) => void;
};

type PartState = {
  partNumber: number;
  size: number;
  loaded: number;
  etag?: string;
  attempts: number;
  status: "pending" | "uploading" | "done" | "error";
};

type ResumeRecord = {
  assetId: string;
  uploadId: string;
  key: string;
  workerUrl: string;
  filename: string;
  size: number;
  partSize: number;
  parts: { partNumber: number; etag: string }[];
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

function readResume(): Record<string, ResumeRecord> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeResume(rec: Record<string, ResumeRecord>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch { /* quota */ }
}
function saveResume(r: ResumeRecord) { const all = readResume(); all[r.assetId] = r; writeResume(all); }
function clearResume(assetId: string) { const all = readResume(); delete all[assetId]; writeResume(all); }

// XHR upload that emits per-part progress events; returns the parsed JSON.
function xhrUpload(
  method: "PUT" | "POST",
  url: string,
  body: Blob | File,
  signal: AbortSignal,
  onProgress?: (loaded: number) => void,
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.responseType = "text";
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable && onProgress) onProgress(ev.loaded); };
    xhr.onerror = () => reject(new Error("network_error"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onload = () => {
      let json: unknown = null;
      try { json = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* non-json */ }
      resolve({ status: xhr.status, json });
    };
    const onAbort = () => xhr.abort();
    if (signal.aborted) { xhr.abort(); reject(new DOMException("aborted", "AbortError")); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(body);
  });
}

async function uploadWithRetry(
  method: "PUT" | "POST",
  url: string,
  body: Blob | File,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
  onAttempt: (attempt: number) => void,
  retries = MAX_RETRIES,
): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    onAttempt(i + 1);
    try {
      // Reset progress on each retry so the bar reflects current attempt.
      onProgress(0);
      const res = await xhrUpload(method, url, body, signal, onProgress);
      if (res.status >= 200 && res.status < 300) return res.json;
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

async function captureThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const t = Math.min(Math.max(v.duration * 0.1, 0.5), v.duration - 0.1);
      v.currentTime = Number.isFinite(t) ? t : 0.5;
    };
    v.onseeked = () => {
      try {
        const w = Math.min(v.videoWidth || 640, 1280);
        const h = Math.round(((v.videoHeight || 360) * w) / (v.videoWidth || 640));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(v, 0, 0, w, h);
        canvas.toBlob((b) => { cleanup(); resolve(b); }, "image/jpeg", 0.8);
      } catch { cleanup(); resolve(null); }
    };
    v.onerror = () => { cleanup(); resolve(null); };
  });
}

export function VideoUploader({ tenantId, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [parts, setParts] = useState<PartState[]>([]);
  const [resumable, setResumable] = useState<Array<{ id: string; original_filename: string | null; size_bytes: number | null }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const currentAsset = useRef<string | null>(null);
  const pendingFile = useRef<File | null>(null);

  const initFn = useServerFn(initVideoUpload);
  const completeFn = useServerFn(completeVideoUpload);
  const abortFn = useServerFn(abortVideoUpload);
  const saveIdFn = useServerFn(saveUploadId);
  const listResumeFn = useServerFn(listResumableUploads);

  useEffect(() => {
    listResumeFn({ data: { tenantId } })
      .then((rows) => setResumable(rows ?? []))
      .catch(() => null);
  }, [tenantId, listResumeFn]);

  function setPart(n: number, patch: Partial<PartState>) {
    setParts((prev) => prev.map((p) => (p.partNumber === n ? { ...p, ...patch } : p)));
  }

  async function uploadThumbnail(workerUrl: string, tenantPrefix: string, file: File, signal: AbortSignal): Promise<string | null> {
    try {
      const blob = await captureThumbnail(file);
      if (!blob) return null;
      const key = `${tenantPrefix}/videos/${crypto.randomUUID()}.jpg`;
      await uploadWithRetry(
        "POST",
        `${workerUrl}/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent("image/jpeg")}`,
        blob,
        signal,
        () => null,
        () => null,
        1,
      );
      return key;
    } catch { return null; }
  }

  async function handleFile(file: File, resumeAssetId?: string) {
    setUploading(true);
    setProgress(0); setUploaded(0); setTotal(file.size); setSpeed(0); setEta(0);
    setFilename(file.name); setParts([]);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const startedAt = Date.now();
    let uploadedBytes = 0;

    const refreshTotals = () => {
      setUploaded(uploadedBytes);
      setProgress(Math.min(100, Math.round((uploadedBytes / file.size) * 100)));
      const elapsed = (Date.now() - startedAt) / 1000;
      const sp = elapsed > 0 ? uploadedBytes / elapsed : 0;
      setSpeed(sp);
      setEta(sp > 0 ? (file.size - uploadedBytes) / sp : 0);
    };

    try {
      const meta = await probeMeta(file);
      const init = await initFn({
        data: {
          tenantId, filename: file.name, mimeType: file.type || "video/mp4",
          sizeBytes: file.size, ...meta,
          ...(resumeAssetId ? { resumeAssetId } : {}),
        },
      });
      currentAsset.current = init.assetId;
      let { key } = init;
      const { workerUrl, partSize } = init;

      {
        // ─── Multipart with resume support ──────────────────────────────
        const totalParts = Math.ceil(file.size / partSize);
        const initialParts: PartState[] = Array.from({ length: totalParts }, (_, i) => {
          const pn = i + 1;
          const start = (pn - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          return { partNumber: pn, size: end - start, loaded: 0, attempts: 0, status: "pending" };
        });
        setParts(initialParts);

        let uploadId = init.uploadId ?? "";
        let alreadyDone: { partNumber: number; etag: string }[] = [];

        if (init.resumed && uploadId) {
          const stored = readResume()[init.assetId];
          if (stored && stored.uploadId === uploadId) alreadyDone = stored.parts;
          for (const p of alreadyDone) {
            const pn = p.partNumber;
            uploadedBytes += initialParts[pn - 1]?.size ?? 0;
            setPart(pn, { loaded: initialParts[pn - 1]?.size ?? 0, status: "done", etag: p.etag });
          }
          refreshTotals();
          toast.message(`استكمال الرفع — تم سابقاً ${alreadyDone.length}/${totalParts} جزء`);
        } else {
          // Begin new multipart. The deployed Worker reads a JSON body and mints
          // its own R2 key, which it returns — we must adopt that key for all
          // subsequent part/complete calls and persist it server-side.
          const contentType = file.type || "video/mp4";
          const startJson = (await uploadWithRetry(
            "POST",
            `${workerUrl}/upload/start`,
            new Blob([JSON.stringify({ key, contentType, filename: file.name })], { type: "application/json" }),
            signal, () => null, () => null,
          )) as { uploadId: string; key: string };
          uploadId = startJson.uploadId;
          if (startJson.key) key = startJson.key;
          // Persist uploadId + final key server-side so a reload can resume.
          await saveIdFn({ data: { assetId: init.assetId, uploadId, key } }).catch(() => null);
        }


        // Save resume record locally NOW so that even a hard reload mid-upload
        // can be picked back up.
        saveResume({
          assetId: init.assetId, uploadId, key, workerUrl,
          filename: file.name, size: file.size, partSize,
          parts: [...alreadyDone],
        });

        const doneParts = [...alreadyDone];
        const pendingQueue = initialParts
          .filter((p) => !alreadyDone.some((d) => d.partNumber === p.partNumber))
          .map((p) => p.partNumber);
        let cursor = 0;

        const worker = async () => {
          while (!signal.aborted) {
            const idx = cursor++;
            if (idx >= pendingQueue.length) return;
            const partNumber = pendingQueue[idx];
            const ps = initialParts[partNumber - 1];
            const start = (partNumber - 1) * partSize;
            const end = Math.min(start + partSize, file.size);
            const blob = file.slice(start, end);
            ps.loaded = 0;
            setPart(partNumber, { status: "uploading", loaded: 0 });
            const json = (await uploadWithRetry(
              "PUT",
              `${workerUrl}/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
              blob, signal,
              (loaded) => {
                const delta = loaded - ps.loaded; ps.loaded = loaded;
                uploadedBytes += delta; refreshTotals();
                setPart(partNumber, { loaded });
              },
              (attempt) => {
                if (attempt > 1) toast.warning(`إعادة المحاولة (${attempt - 1}) للجزء #${partNumber}`);
                setPart(partNumber, { attempts: attempt });
              },
            )) as { partNumber: number; etag: string };
            doneParts.push({ partNumber: json.partNumber, etag: json.etag });
            setPart(partNumber, { status: "done", etag: json.etag, loaded: ps.size });
            // Update resume record after each completed part.
            saveResume({
              assetId: init.assetId, uploadId, key, workerUrl,
              filename: file.name, size: file.size, partSize,
              parts: [...doneParts],
            });
          }
        };

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pendingQueue.length || 1) }, worker));
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        await uploadWithRetry(
          "POST",
          `${workerUrl}/upload/complete`,
          new Blob([JSON.stringify({ key, uploadId, parts: doneParts })], { type: "application/json" }),
          signal, () => null, () => null,
        );
      }

      // Thumbnails skipped — this Worker only supports multipart uploads.
      const thumbKey: string | null = null;


      await completeFn({
        data: {
          assetId: init.assetId,
          ...(thumbKey ? { thumbnailKey: thumbKey } : {}),
          ...(meta.durationSeconds != null ? { durationSeconds: meta.durationSeconds } : {}),
          ...(meta.width ? { width: meta.width } : {}),
          ...(meta.height ? { height: meta.height } : {}),
        },
      });
      clearResume(init.assetId);
      toast.success("تم رفع الفيديو");
      onUploaded?.(init.assetId);
      currentAsset.current = null;
      // Refresh resumable list
      listResumeFn({ data: { tenantId } }).then((rows) => setResumable(rows ?? [])).catch(() => null);
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        toast.message("تم إيقاف الرفع — يمكن استكماله لاحقاً");
      } else {
        toast.error(err.message || "فشل الرفع");
      }
      // Do not auto-abort the server-side asset here — user may want to resume.
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      pendingFile.current = null;
    }
  }

  function cancel() { abortRef.current?.abort(); }

  async function cancelAndAbort() {
    abortRef.current?.abort();
    if (currentAsset.current) {
      await abortFn({ data: { assetId: currentAsset.current } }).catch(() => null);
      clearResume(currentAsset.current);
      currentAsset.current = null;
    }
  }

  async function chooseResume(assetId: string) {
    // The resume needs the original File handle (browser cannot recover it).
    // Ask user to re-select the same file.
    pendingFile.current = null;
    const input = fileRef.current;
    if (!input) return;
    input.dataset.resumeAssetId = assetId;
    input.click();
  }

  return (
    <div className="space-y-3 border rounded-lg p-4" dir="rtl">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const resumeAssetId = e.target.dataset.resumeAssetId;
          delete e.target.dataset.resumeAssetId;
          if (f) handleFile(f, resumeAssetId);
        }}
      />

      {!uploading && resumable.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs space-y-2">
          <p className="font-medium text-amber-900">رفع غير مكتمل ({resumable.length})</p>
          {resumable.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1">{r.original_filename || r.id} — {formatBytes(r.size_bytes ?? 0)}</span>
              <Button size="sm" variant="outline" onClick={() => chooseResume(r.id)}>
                <RotateCw className="h-3 w-3 ml-1" /> استكمل (أعد اختيار الملف)
              </Button>
            </div>
          ))}
        </div>
      )}

      {!uploading ? (
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 ml-2" /> اختر ملف فيديو
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate max-w-[55%]" title={filename ?? ""}>{filename}</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">{progress}%</span>
              <Button size="sm" variant="ghost" onClick={cancel} title="إيقاف مؤقت">
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelAndAbort} title="إلغاء وإنهاء">
                إلغاء كلي
              </Button>
            </div>
          </div>
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatBytes(uploaded)} / {formatBytes(total)}</span>
            <span>{formatBytes(speed)}/ث</span>
            <span>متبقي: {formatEta(eta)}</span>
          </div>
          {parts.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">الأجزاء ({parts.filter((p) => p.status === "done").length}/{parts.length})</p>
              <div className="grid grid-cols-10 gap-1">
                {parts.map((p) => {
                  const pct = p.size > 0 ? Math.round((p.loaded / p.size) * 100) : 0;
                  const color =
                    p.status === "done" ? "bg-green-500"
                    : p.status === "error" ? "bg-destructive"
                    : p.status === "uploading" ? "bg-primary"
                    : "bg-muted";
                  return (
                    <div key={p.partNumber}
                      className="relative h-3 rounded bg-muted overflow-hidden"
                      title={`جزء ${p.partNumber} — ${pct}% ${p.attempts > 1 ? `(محاولة ${p.attempts})` : ""}`}>
                      <div className={`absolute inset-y-0 right-0 ${color}`} style={{ width: `${pct}%` }} />
                      {p.attempts > 1 && p.status !== "done" && (
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold">
                          ↻{p.attempts}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        الفيديوهات ≤ 100MB تُرفع كملف واحد. الأكبر تُقسَّم إلى أجزاء 10MB مع استكمال تلقائي ولقطة غلاف.
      </p>
    </div>
  );
}
