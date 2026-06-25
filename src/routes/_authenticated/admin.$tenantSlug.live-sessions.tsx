import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Video, ExternalLink, Trash2, Edit, Calendar, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/live-sessions")({
  component: LiveSessionsAdmin,
});

type Session = {
  id: string;
  title: string;
  description: string | null;
  meeting_url: string;
  provider: string;
  scheduled_at: string;
  duration_minutes: number;
  recording_url: string | null;
  status: string;
  course_id: string | null;
};

function LiveSessionsAdmin() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/live-sessions" });
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: sessions, refetch } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["live-sessions-admin", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("scheduled_at", { ascending: false });
      return (data ?? []) as Session[];
    },
  });

  const { data: courses } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["tenant-courses-list", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [editing, setEditing] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);

  async function remove(id: string) {
    if (!confirm("حذف الجلسة نهائياً؟")) return;
    const { error } = await supabase.from("live_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    refetch();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">الجلسات الحيّة</h1>
          <p className="text-muted-foreground">جدول جلسات Zoom / Google Meet / Jitsi لطلابك.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 ms-1" /> جلسة جديدة
            </Button>
          </DialogTrigger>
          <SessionForm
            key={editing?.id ?? "new"}
            tenantId={tenant?.id}
            userId={user?.id}
            courses={courses ?? []}
            editing={editing}
            onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["live-sessions-admin", tenant?.id] }); }}
          />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {sessions?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Video className="h-10 w-10 mx-auto mb-2 opacity-40" />
              لا توجد جلسات بعد. اضغط "جلسة جديدة" لإضافة أول جلسة.
            </CardContent>
          </Card>
        )}
        {sessions?.map((s) => {
          const when = new Date(s.scheduled_at);
          const isPast = when.getTime() + s.duration_minutes * 60_000 < Date.now();
          const isLive = !isPast && when.getTime() <= Date.now();
          const statusLabel = isLive ? "مباشر الآن" : isPast ? "انتهت" : "قادمة";
          const statusColor = isLive ? "bg-red-500 text-white" : isPast ? "bg-muted" : "bg-emerald-500/15 text-emerald-700";
          return (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold">{s.title}</h3>
                    <Badge className={statusColor}>{statusLabel}</Badge>
                    <Badge variant="outline" className="text-xs">{s.provider}</Badge>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {when.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })} · {s.duration_minutes} دقيقة
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(s.meeting_url); toast.success("نُسخ الرابط"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a href={s.meeting_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 ms-1" /> فتح</Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SessionForm({
  tenantId, userId, courses, editing, onDone,
}: {
  tenantId?: string; userId?: string;
  courses: { id: string; title: string }[];
  editing: Session | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [meetingUrl, setMeetingUrl] = useState(editing?.meeting_url ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? "zoom");
  const [scheduledAt, setScheduledAt] = useState(
    editing ? new Date(editing.scheduled_at).toISOString().slice(0, 16) : "",
  );
  const [duration, setDuration] = useState(editing?.duration_minutes ?? 60);
  const [recordingUrl, setRecordingUrl] = useState(editing?.recording_url ?? "");
  const [courseId, setCourseId] = useState(editing?.course_id ?? "none");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!tenantId || !title || !meetingUrl || !scheduledAt) {
      toast.error("املأ الحقول المطلوبة");
      return;
    }
    setBusy(true);
    const payload = {
      tenant_id: tenantId,
      title,
      description: description || null,
      meeting_url: meetingUrl,
      provider: provider as "zoom" | "google_meet" | "jitsi" | "teams" | "other",
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: Number(duration) || 60,
      recording_url: recordingUrl || null,
      course_id: courseId === "none" ? null : courseId,
      created_by: userId ?? null,
    };
    const { error } = editing
      ? await supabase.from("live_sessions").update(payload).eq("id", editing.id)
      : await supabase.from("live_sessions").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "تم التحديث" : "تم إنشاء الجلسة");
    onDone();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "تعديل الجلسة" : "جلسة جديدة"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>العنوان *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مراجعة الأسبوع الأول" /></div>
        <div><Label>الوصف</Label><Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>المزوّد *</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="google_meet">Google Meet</SelectItem>
                <SelectItem value="jitsi">Jitsi</SelectItem>
                <SelectItem value="teams">Teams</SelectItem>
                <SelectItem value="other">أخرى</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الدورة (اختياري)</Label>
            <Select value={courseId ?? "none"} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">عام (كل المنصة)</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>رابط الاجتماع *</Label><Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>التاريخ والوقت *</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
          <div><Label>المدة (دقيقة)</Label><Input type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
        </div>
        <div><Label>رابط التسجيل (بعد الجلسة)</Label><Input value={recordingUrl ?? ""} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://..." /></div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
