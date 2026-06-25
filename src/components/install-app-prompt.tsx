import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "eduforge_install_dismissed_at";

export function InstallAppPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Hide if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Respect recent dismissal (7 days)
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !evt) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 sm:inset-x-auto sm:right-4 sm:max-w-sm">
      <div className="bg-card border shadow-xl rounded-2xl p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">ثبّت التطبيق</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            احصل على تجربة أسرع كأنه تطبيق على جهازك.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={async () => {
                await evt.prompt();
                await evt.userChoice;
                setHidden(true);
              }}
            >
              تثبيت
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, String(Date.now()));
                setHidden(true);
              }}
            >
              لاحقاً
            </Button>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setHidden(true);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
