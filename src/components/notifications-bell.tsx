import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const unread = notifications?.filter((n) => !n.is_read).length ?? 0;

  if (!user) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">{unread}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-bold text-sm">الإشعارات</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAllRead.mutate()}>
              <Check className="h-3 w-3 ml-1" />تعليم الكل كمقروء
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {(notifications ?? []).length === 0 && (
            <p className="text-sm text-center text-muted-foreground p-6">لا توجد إشعارات</p>
          )}
          {(notifications ?? []).map((n) => {
            const body = (
              <div className={cn("p-3 border-b text-sm cursor-pointer hover:bg-accent", !n.is_read && "bg-accent/50")}
                onClick={() => !n.is_read && markOneRead.mutate(n.id)}>
                <div className="font-medium">{n.title}</div>
                {n.message && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar")}</div>
              </div>
            );
            return n.link
              ? <Link key={n.id} to={n.link as string}>{body}</Link>
              : <div key={n.id}>{body}</div>;
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
