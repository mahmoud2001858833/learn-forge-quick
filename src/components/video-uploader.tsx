import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X, RotateCw, Loader2, CheckCircle2 } from "lucide-react";
import { listResumableUploads } from "@/lib/video.functions";
import { useUploads } from "@/hooks/use-uploads";
import {
  enqueueUpload,
  cancelUpload,
  formatBytes,
  formatEta,
} from "@/lib/upload-manager";

type Props = {
  tenantId: string;
  onUploaded?: (assetId: string) => void;
};

/**
 * Thin UI over the global upload manager: the actual transfer runs outside
 * React, so closing this dialog or navigating away never cancels an upload.
 */
export function VideoUploader({ tenantId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resumable, setResumable] = useState<
    { id: string; filename: string; size_bytes: number }[]
  >([]);

  const uploads = useUploads();
  const task = uploads.find((u) => u.id === taskId) ?? null;
  const busy = task?.status === "uploading" || task?.status === "preparing" || task?.status === "processing";

  useEffect(() => {
    let alive = true;
    listResumableUploads({ data: { tenantId } })
      .then((rows: any) => { if (alive) setResumable(Array.isArray(rows) ? rows : []); })
      .catch(() => null);
    return () => { alive = false; };
  }, [tenantId]);

  const start = (file: File, resumeAssetId?: string) => {
    const id = enqueueUpload({
      tenantId,
      file,
      resumeAssetId,
      onDone: (assetId) => onUploaded?.(assetId),
      onError: (m) => toast.error(m),
    });
    setTaskId(id);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) start(f);
        }}
      />

      {!busy && (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="w-full">
          <Upload className="h-4 w-4 me-2" />
          اختر ملف فيديو
        </Button>
      )}

      {task && (task.status === "uploading" || task.status === "preparing") && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate flex-1">{task.filename}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelUpload(task.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Progress value={task.progress} />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{task.progress}% · {formatBytes(task.uploaded)}/{formatBytes(task.size)}</span>
            <span>{formatBytes(task.speed)}/ث · {formatEta(task.eta)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            يمكنك متابعة العمل — الرفع يكمل في الخلفية.
          </p>
        </div>
      )}

      {task?.status === "processing" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> تتم المعالجة في الخلفية…
        </p>
      )}
      {task?.status === "done" && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> تم الرفع بنجاح
        </p>
      )}
      {task?.status === "error" && (
        <p className="text-xs text-destructive">{task.error}</p>
      )}

      {!busy && resumable.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium">رفعات غير مكتملة</p>
          {resumable.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate flex-1">{r.filename} · {formatBytes(r.size_bytes)}</span>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "video/*";
                  input.onchange = () => {
                    const f = input.files?.[0];
                    if (f) start(f, r.id);
                  };
                  input.click();
                }}
              >
                <RotateCw className="h-3 w-3 me-1" /> استئناف
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
