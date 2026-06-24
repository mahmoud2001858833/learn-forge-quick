import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GraduationCap, Building2, BookMarked } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/academic")({
  component: AcademicPage,
});

type University = { id: string; name: string; country: string | null; sort_order: number };
type College = { id: string; name: string; university_id: string; sort_order: number };
type Major = { id: string; name: string; college_id: string; years_count: number; sort_order: number };

function AcademicPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/academic" });
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id").eq("slug", tenantSlug).maybeSingle();
      return data;
    },
  });
  const tenantId = tenant?.id;

  const [selectedUni, setSelectedUni] = useState<string | null>(null);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  const { data: universities = [] } = useQuery({
    queryKey: ["universities", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities").select("id, name, country, sort_order")
        .eq("tenant_id", tenantId!).order("sort_order").order("name");
      if (error) throw error;
      return data as University[];
    },
  });

  const { data: colleges = [] } = useQuery({
    queryKey: ["colleges", selectedUni],
    enabled: !!selectedUni,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colleges").select("id, name, university_id, sort_order")
        .eq("university_id", selectedUni!).order("sort_order").order("name");
      if (error) throw error;
      return data as College[];
    },
  });

  const { data: majors = [] } = useQuery({
    queryKey: ["majors", selectedCol],
    enabled: !!selectedCol,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("majors").select("id, name, college_id, years_count, sort_order")
        .eq("college_id", selectedCol!).order("sort_order").order("name");
      if (error) throw error;
      return data as Major[];
    },
  });

  if (!tenantId) return <div>جارٍ التحميل...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          الهيكل الأكاديمي
        </h1>
        <p className="text-muted-foreground mt-1">إدارة الجامعات والكليات والتخصصات</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Universities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5" /> الجامعات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AddUniversityForm tenantId={tenantId} onCreated={() => qc.invalidateQueries({ queryKey: ["universities", tenantId] })} />
            <div className="space-y-1">
              {universities.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد بعد</p>}
              {universities.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setSelectedUni(u.id); setSelectedCol(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm hover:bg-accent text-right ${selectedUni === u.id ? "bg-accent" : ""}`}
                >
                  <span>{u.name}{u.country ? ` · ${u.country}` : ""}</span>
                  <DeleteBtn onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm("حذف الجامعة وكل ما يتبعها؟")) return;
                    const { error } = await supabase.from("universities").delete().eq("id", u.id);
                    if (error) return toast.error(error.message);
                    if (selectedUni === u.id) setSelectedUni(null);
                    qc.invalidateQueries({ queryKey: ["universities", tenantId] });
                  }} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Colleges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5" /> الكليات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedUni ? (
              <p className="text-sm text-muted-foreground">اختر جامعة أولاً</p>
            ) : (
              <>
                <AddCollegeForm tenantId={tenantId} universityId={selectedUni} onCreated={() => qc.invalidateQueries({ queryKey: ["colleges", selectedUni] })} />
                <div className="space-y-1">
                  {colleges.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد بعد</p>}
                  {colleges.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCol(c.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm hover:bg-accent text-right ${selectedCol === c.id ? "bg-accent" : ""}`}
                    >
                      <span>{c.name}</span>
                      <DeleteBtn onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("حذف الكلية؟")) return;
                        const { error } = await supabase.from("colleges").delete().eq("id", c.id);
                        if (error) return toast.error(error.message);
                        if (selectedCol === c.id) setSelectedCol(null);
                        qc.invalidateQueries({ queryKey: ["colleges", selectedUni] });
                      }} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Majors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="h-5 w-5" /> التخصصات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedCol ? (
              <p className="text-sm text-muted-foreground">اختر كلية أولاً</p>
            ) : (
              <>
                <AddMajorForm tenantId={tenantId} collegeId={selectedCol} onCreated={() => qc.invalidateQueries({ queryKey: ["majors", selectedCol] })} />
                <div className="space-y-1">
                  {majors.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد بعد</p>}
                  {majors.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded text-sm hover:bg-accent">
                      <span>{m.name} <span className="text-muted-foreground text-xs">({m.years_count} سنوات)</span></span>
                      <DeleteBtn onClick={async () => {
                        if (!confirm("حذف التخصص؟")) return;
                        const { error } = await supabase.from("majors").delete().eq("id", m.id);
                        if (error) return toast.error(error.message);
                        qc.invalidateQueries({ queryKey: ["majors", selectedCol] });
                      }} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="button"
      onClick={onClick}
      className="p-1 rounded hover:bg-destructive/20 text-destructive cursor-pointer"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </span>
  );
}

function AddUniversityForm({ tenantId, onCreated }: { tenantId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("universities").insert({
      tenant_id: tenantId, name: name.trim(), country: country.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); setCountry("");
    onCreated();
    toast.success("تمت الإضافة");
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 border rounded">
      <div>
        <Label className="text-xs">اسم الجامعة</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="جامعة الملك سعود" />
      </div>
      <div>
        <Label className="text-xs">البلد (اختياري)</Label>
        <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="السعودية" />
      </div>
      <Button type="submit" size="sm" disabled={busy} className="w-full">
        <Plus className="h-4 w-4 ml-1" /> إضافة جامعة
      </Button>
    </form>
  );
}

function AddCollegeForm({ tenantId, universityId, onCreated }: { tenantId: string; universityId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("colleges").insert({
      tenant_id: tenantId, university_id: universityId, name: name.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    onCreated();
    toast.success("تمت الإضافة");
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 border rounded">
      <div>
        <Label className="text-xs">اسم الكلية</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="كلية الهندسة" />
      </div>
      <Button type="submit" size="sm" disabled={busy} className="w-full">
        <Plus className="h-4 w-4 ml-1" /> إضافة كلية
      </Button>
    </form>
  );
}

function AddMajorForm({ tenantId, collegeId, onCreated }: { tenantId: string; collegeId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [years, setYears] = useState("4");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("majors").insert({
      tenant_id: tenantId, college_id: collegeId,
      name: name.trim(), years_count: parseInt(years) || 4,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); setYears("4");
    onCreated();
    toast.success("تمت الإضافة");
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 border rounded">
      <div>
        <Label className="text-xs">اسم التخصص</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="هندسة برمجيات" />
      </div>
      <div>
        <Label className="text-xs">عدد السنوات</Label>
        <Select value={years} onValueChange={setYears}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6, 7].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={busy} className="w-full">
        <Plus className="h-4 w-4 ml-1" /> إضافة تخصص
      </Button>
    </form>
  );
}
