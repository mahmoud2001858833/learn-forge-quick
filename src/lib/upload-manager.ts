/**
 * Global background upload manager.
 *
 * Uploads run outside the React tree in a module-level singleton, so closing a
 * dialog or navigating between pages never cancels an upload. Components
 * subscribe through `useSyncExternalStore`, and progress notifications are
 * throttled to one animation frame so a 4 GB upload can never starve the UI
 * thread with re-renders.
 */
import {
  initVideoUpload,
  completeVideoUpload,
  abortVideoUpload,
  saveUploadId,
} from "@/lib/video.functions";

const CONCURRENCY = 3;
const MAX_RETRIES = 3;
const LS_KEY = "lovable.video.resume.v1";

export type UploadStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "processing"
  | "done"
  | "error"
  | "canceled";

export type UploadTask = {
  id: string;
  tenantId: string;
  assetId: string | null;
  filename: string;
  size: number;
  uploaded: number;
  progress: number;
  speed: number;
  eta: number;
  status: UploadStatus;
  error?: string;
  partsDone: number;
  partsTotal: number;
};

type ResumeRecord = {
  assetId: string; uploadId: string; key: string; workerUrl: string;
  filename: string; size: number; partSize: number;
  parts: { partNumber: number; etag: string }[];
};

function readResume(): Record<string, ResumeRecord> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeResume(rec: Record<string, ResumeRecord>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch { /* quota */ }
}
function saveResume(r: ResumeRecord) { const all = readResume(); all[r.assetId] = r; writeResume(all); }
function clearResume(assetId: string) { const all = readResume(); delete all[assetId]; writeResume(all); }

// ── store ────────────────────────────────────────────────────────────────
let tasks: UploadTask[] = [];
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();
let notifyScheduled = false;

function emit() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  const schedule =
    typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 32);
  schedule(() => {
    notifyScheduled = false;
    for (const l of listeners) l();
  });
}

function patch(id: string, p: Partial<UploadTask>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...p } : t));
  emit();
}

export function subscribeUploads(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getUploadSnapshot(): UploadTask[] { return tasks; }
export function getServerUploadSnapshot(): UploadTask[] { return []; }

export function dismissUpload(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  emit();
}
export function pauseUpload(id: string) {
  controllers.get(id)?.abort();
}
export async function cancelUpload(id: string) {
  controllers.get(id)?.abort();
  const t = tasks.find((x) => x.id === id);
  if (t?.assetId) {
    await abortVideoUpload({ data: { assetId: t.assetId } }).catch(() => null);
    clearResume(t.assetId);
  }
  patch(id, { status: "canceled" });
}

// ── network helpers ──────────────────────────────────────────────────────
function xhrUpload(
  method: "PUT" | "POST", url: string, body: Blob | File, signal: AbortSignal,
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
    if (signal.aborted) { reject(new DOMException("aborted", "AbortError")); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(body);
  });
}

async function uploadWithRetry(
  method: "PUT" | "POST", url: string, body: Blob | File, signal: AbortSignal,
  onProgress: (loaded: number) => void, retries = MAX_RETRIES,
): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
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
    v.preload = "metadata"; v.muted = true; v.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const out = {
        durationSeconds: Number.isFinite(v.duration) ? Math.round(v.duration) : undefined,
        width: v.videoWidth || undefined,
        height: v.videoHeight || undefined,
      };
      cleanup(); resolve(out);
    };
    v.onerror = () => { cleanup(); resolve({}); };
  });
}

/** Fire-and-forget kick so the background worker starts immediately. */
function kickWorker() {
  try {
    fetch("/api/public/hooks/video-jobs", { method: "POST", keepalive: true }).catch(() => null);
  } catch { /* ignore */ }
}

// ── main entry point ─────────────────────────────────────────────────────
export function enqueueUpload(opts: {
  tenantId: string;
  file: File;
  resumeAssetId?: string;
  onDone?: (assetId: string) => void;
  onError?: (message: string) => void;
}): string {
  const id = crypto.randomUUID();
  const task: UploadTask = {
    id, tenantId: opts.tenantId, assetId: null,
    filename: opts.file.name, size: opts.file.size,
    uploaded: 0, progress: 0, speed: 0, eta: 0,
    status: "preparing", partsDone: 0, partsTotal: 0,
  };
  tasks = [task, ...tasks];
  emit();
  void runUpload(id, opts);
  return id;
}

async function runUpload(
  id: string,
  opts: { tenantId: string; file: File; resumeAssetId?: string; onDone?: (assetId: string) => void; onError?: (m: string) => void },
) {
  const { file, tenantId, resumeAssetId } = opts;
  const controller = new AbortController();
  controllers.set(id, controller);
  const signal = controller.signal;
  const startedAt = Date.now();
  let uploadedBytes = 0;
  let lastPatch = 0;

  const refresh = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPatch < 200) return; // throttle store writes
    lastPatch = now;
    const elapsed = (now - startedAt) / 1000;
    const sp = elapsed > 0 ? uploadedBytes / elapsed : 0;
    patch(id, {
      uploaded: uploadedBytes,
      progress: Math.min(100, Math.round((uploadedBytes / file.size) * 100)),
      speed: sp,
      eta: sp > 0 ? (file.size - uploadedBytes) / sp : 0,
    });
  };

  try {
    const meta = await probeMeta(file);
    const init = await initVideoUpload({
      data: {
        tenantId, filename: file.name, mimeType: file.type || "video/mp4",
        sizeBytes: file.size, ...meta,
        ...(resumeAssetId ? { resumeAssetId } : {}),
      },
    });
    patch(id, { assetId: init.assetId, status: "uploading" });

    let { key } = init;
    const { workerUrl, partSize } = init;
    const totalParts = Math.ceil(file.size / partSize);
    const partSizes = Array.from({ length: totalParts }, (_, i) => {
      const start = i * partSize;
      return Math.min(start + partSize, file.size) - start;
    });
    patch(id, { partsTotal: totalParts });

    let uploadId = init.uploadId ?? "";
    let alreadyDone: { partNumber: number; etag: string }[] = [];

    if (init.resumed && uploadId) {
      const stored = readResume()[init.assetId];
      if (stored && stored.uploadId === uploadId) {
        alreadyDone = stored.parts;
        key = stored.key || key;
      }
      for (const p of alreadyDone) uploadedBytes += partSizes[p.partNumber - 1] ?? 0;
      patch(id, { partsDone: alreadyDone.length });
      refresh(true);
    } else {
      const contentType = file.type || "video/mp4";
      const startJson = (await uploadWithRetry(
        "POST", `${workerUrl}/upload/start`,
        new Blob([JSON.stringify({ key, contentType, filename: file.name })], { type: "application/json" }),
        signal, () => null,
      )) as { uploadId: string; key: string };
      uploadId = startJson.uploadId;
      if (startJson.key) key = startJson.key;
      await saveUploadId({ data: { assetId: init.assetId, uploadId, key } }).catch(() => null);
    }

    saveResume({
      assetId: init.assetId, uploadId, key, workerUrl,
      filename: file.name, size: file.size, partSize, parts: [...alreadyDone],
    });

    const doneParts = [...alreadyDone];
    const queue = Array.from({ length: totalParts }, (_, i) => i + 1)
      .filter((pn) => !alreadyDone.some((d) => d.partNumber === pn));
    let cursor = 0;

    const worker = async () => {
      while (!signal.aborted) {
        const idx = cursor++;
        if (idx >= queue.length) return;
        const partNumber = queue[idx];
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        let partLoaded = 0;
        const json = (await uploadWithRetry(
          "PUT",
          `${workerUrl}/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
          file.slice(start, end), signal,
          (loaded) => {
            uploadedBytes += loaded - partLoaded;
            partLoaded = loaded;
            refresh();
          },
        )) as { partNumber: number; etag: string };
        doneParts.push({ partNumber: json.partNumber, etag: json.etag });
        patch(id, { partsDone: doneParts.length });
        refresh(true);
        saveResume({
          assetId: init.assetId, uploadId, key, workerUrl,
          filename: file.name, size: file.size, partSize, parts: [...doneParts],
        });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
    if (signal.aborted) throw new DOMException("aborted", "AbortError");

    await uploadWithRetry(
      "POST", `${workerUrl}/upload/complete`,
      new Blob([JSON.stringify({ key, uploadId, parts: doneParts })], { type: "application/json" }),
      signal, () => null,
    );

    // Bytes are stored — the rest is finalized by the background job queue.
    patch(id, { status: "processing", progress: 100, uploaded: file.size });
    await completeFinalize(init.assetId, meta);
    clearResume(init.assetId);
    patch(id, { status: "done" });
    opts.onDone?.(init.assetId);
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") patch(id, { status: "canceled" });
    else {
      patch(id, { status: "error", error: err.message || "فشل الرفع" });
      opts.onError?.(err.message || "فشل الرفع");
    }
  } finally {
    controllers.delete(id);
  }
}

async function completeFinalize(
  assetId: string,
  meta: { durationSeconds?: number; width?: number; height?: number },
) {
  await completeVideoUpload({
    data: {
      assetId,
      ...(meta.durationSeconds != null ? { durationSeconds: meta.durationSeconds } : {}),
      ...(meta.width ? { width: meta.width } : {}),
      ...(meta.height ? { height: meta.height } : {}),
    },
  });
  kickWorker();
}

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)} ث`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m} د ${s} ث`;
}
