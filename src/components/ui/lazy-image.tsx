import { forwardRef, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Set to true only for the LCP image on the page. */
  priority?: boolean;
}

/**
 * Default-optimized <img>: lazy loading, async decoding, low fetch priority.
 * Pass `priority` for the one hero/LCP image per route.
 */
export const LazyImage = forwardRef<HTMLImageElement, LazyImageProps>(
  ({ priority = false, className, alt, ...rest }, ref) => {
    return (
      <img
        ref={ref}
        alt={alt ?? ""}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        className={cn(className)}
        {...rest}
      />
    );
  },
);
LazyImage.displayName = "LazyImage";
