import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  sessionToken: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  sessionToken: null,
});

const SESSION_TOKEN_KEY = "eduforge.session_token";

function getOrCreateLocalSessionToken(): string {
  try {
    const existing = localStorage.getItem(SESSION_TOKEN_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
      if (s) setSessionToken(getOrCreateLocalSessionToken());
      else {
        setSessionToken(null);
        try {
          localStorage.removeItem(SESSION_TOKEN_KEY);
        } catch {
          /* ignore */
        }
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) setSessionToken(getOrCreateLocalSessionToken());
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Single-device enforcement: subscribe to active_sessions row for current user.
  useEffect(() => {
    if (!session?.user?.id || !sessionToken) return;
    const userId = session.user.id;

    const ch = supabase
      .channel(`active_sessions:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_sessions", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const newRow = payload.new as { session_token?: string } | null;
          if (newRow?.session_token && newRow.session_token !== sessionToken) {
            await supabase.auth.signOut();
            try {
              localStorage.removeItem(SESSION_TOKEN_KEY);
            } catch {
              /* ignore */
            }
            // Soft reload to land on /auth
            if (typeof window !== "undefined") window.location.href = "/auth";
          }
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session?.user?.id, sessionToken]);

  // Global logout check: when profile.global_logout_at > session.created_at, sign out.
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const sessionCreatedSec = (session.user as User & { created_at?: string }).created_at
      ? Math.floor(new Date(session.user.created_at!).getTime() / 1000)
      : 0;
    // Use the actual access-token iat when available
    const iat = (() => {
      try {
        const payload = JSON.parse(atob(session.access_token.split(".")[1] ?? "")) as {
          iat?: number;
        };
        return payload.iat ?? sessionCreatedSec;
      } catch {
        return sessionCreatedSec;
      }
    })();

    supabase
      .from("profiles")
      .select("global_logout_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.global_logout_at) return;
        const cutoff = Math.floor(new Date(data.global_logout_at).getTime() / 1000);
        if (cutoff > iat) {
          supabase.auth.signOut().finally(() => {
            if (typeof window !== "undefined") window.location.href = "/auth";
          });
        }
      });
  }, [session?.user?.id, session?.access_token]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, sessionToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getLocalSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function resetLocalSessionToken(): string {
  const fresh = crypto.randomUUID();
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, fresh);
  } catch {
    /* ignore */
  }
  return fresh;
}
