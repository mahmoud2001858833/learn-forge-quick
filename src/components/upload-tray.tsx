import { useState } from "react";
import { useUploads } from "@/hooks/use-uploads";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cancelUpload, dismissUpload, formatBytes, formatEta } from "@/lib/upload-manager";

/**
 * Floating tray that keeps upload progress visible no matter which page the
 * user is on. Uploads keep running in the background manager.
 */
export function UploadTray() {
  const uploads = useUploads();
  const [open, setOpen] = useState(true);
  if (uploads.length === 0) return null;

  const active = uploads.filter((u) => u.status === "uploading" || u.status === "processing" || u.status === "preparing");

  return (
    <div dir="rtl" className="fixed bottom-4 start-4 z-50 w-[min(92vw,22rem)]">
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold bg-muted/60"
        >
          <span className="flex items-center gap-2">
            {active.length > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {active.length > 0 ? `جارٍ رفع ${active.length} فيديو` : "اكتمل الرفع"}
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {open && (
          <div className="max-h-72 overflow-y-auto divide-y">
            {uploads.map((u) => (
              <div key={u.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate flex-1" title={u.filename}>{u.filename}</span>
                  {u.status === "done" || u.status === "error" || u.status === "canceled" ? (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => dismissUpload(u.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => cancelUpload(u.id)}>
                      إلغاء
                    </Button>
                  )}
                </div>

                {u.status === "processing" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> تتم المعالجة في الخلفية…
                  </p>
                )}
                {u.status === "done" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> جاهز للعرض
                  </p>
                )}
                {u.status === "error" && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {u.error}
                  </p>
                )}
                {(u.status === "uploading" || u.status === "preparing") && (
                  <>
                    <Progress value={u.progress} />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>{u.progress}% · {formatBytes(u.uploaded)}/{formatBytes(u.size)}</span>
                      <span>{formatBytes(u.speed)}/ث · {formatEta(u.eta)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
