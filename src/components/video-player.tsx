import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPlaybackUrl } from "@/lib/video.functions";

type Props = {
  assetId: string;
  poster?: string;
  className?: string;
};

export function VideoPlayer({ assetId, poster, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const getUrl = useServerFn(getPlaybackUrl);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setErr(null);
    getUrl({ data: { assetId } })
      .then((r) => { if (alive) setUrl(r.url); })
      .catch((e: Error) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [assetId, getUrl]);

  if (err) return <div className="p-4 text-sm text-destructive">تعذّر تحميل الفيديو: {err}</div>;
  if (!url) return <div className="aspect-video bg-muted animate-pulse rounded" />;

  return (
    <video
      src={url}
      poster={poster}
      controls
      controlsList="nodownload"
      className={className ?? "w-full rounded"}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
