import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const markAll = useMutation({
    mutationFn: async () => { await supabase.rpc("mark_all_notifications_read"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-page", user?.id] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-page", user?.id] }),
  });

  return (
    <main className="container mx-auto max-w-3xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الإشعارات</h1>
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
          <Check className="h-4 w-4 ml-1" />تعليم الكل كمقروء
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {(notifications ?? []).length === 0 && <p className="text-center text-muted-foreground p-10">لا توجد إشعارات</p>}
          {(notifications ?? []).map((n) => {
            const body = (
              <div className={cn("p-4 flex items-start gap-3", !n.is_read && "bg-accent/40")}>
                <div className="flex-1">
                  <div className="font-medium">{n.title}</div>
                  {n.message && <div className="text-sm text-muted-foreground mt-1">{n.message}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar")}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={(e) => { e.preventDefault(); del.mutate(n.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
            return (
              <div key={n.id} className="border-b last:border-0">
                {n.link ? <Link to={n.link as string}>{body}</Link> : body}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
