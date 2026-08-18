import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

/**
 * Window-based virtualized grid.
 * Renders only visible rows so huge lists (courses/students) stay smooth.
 */
export function VirtualGrid<T>({
  items,
  renderItem,
  estimateRowHeight = 340,
  gap = 24,
  className = "",
  minColumnWidth = 320,
  maxColumns = 3,
  getKey,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateRowHeight?: number;
  gap?: number;
  className?: string;
  minColumnWidth?: number;
  maxColumns?: number;
  getKey?: (item: T, index: number) => string | number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () => {
      const width = el.offsetWidth || 0;
      const cols = Math.max(1, Math.min(maxColumns, Math.floor(width / minColumnWidth) || 1));
      setColumns(cols);
      setOffset(el.getBoundingClientRect().top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [minColumnWidth, maxColumns]);

  const rowCount = Math.ceil(items.length / columns);
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateRowHeight + gap,
    overscan: 3,
    scrollMargin: offset,
  });

  return (
    <div ref={parentRef} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * columns;
          const rowItems = items.slice(start, start + columns);
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                insetInlineStart: 0,
                width: "100%",
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap,
                paddingBottom: gap,
              }}
            >
              {rowItems.map((item, i) => (
                <div key={getKey ? getKey(item, start + i) : start + i}>
                  {renderItem(item, start + i)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Window-based virtualized rows (tables/lists). */
export function VirtualRows<T>({
  items,
  renderRow,
  estimateRowHeight = 52,
  getKey,
}: {
  items: T[];
  renderRow: (item: T, index: number) => ReactNode;
  estimateRowHeight?: number;
  getKey?: (item: T, index: number) => string | number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () => setOffset(el.getBoundingClientRect().top + window.scrollY);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
    scrollMargin: offset,
  });

  return (
    <div ref={parentRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={getKey ? getKey(items[v.index], v.index) : v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              insetInlineStart: 0,
              width: "100%",
              transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {renderRow(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const VIRTUALIZE_THRESHOLD = 24;
