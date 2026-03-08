"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { iconDataToSvg } from "@/lib/icon-to-svg";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpen, Search } from "lucide-react";

interface IconNode {
  tag: string;
  attr: Record<string, string>;
  child: IconNode[];
}

interface IconData {
  attr: Record<string, string>;
  child: IconNode[];
}

// [displayName, iconData]
type IconEntry = [string, IconData];

interface ManifestEntry {
  id: string;
  name: string;
  count: number;
}

const COLUMNS = 6;

function renderIconChildren(children: IconNode[]): React.ReactNode {
  return children.map((node, i) => {
    const { tag, attr, child } = node;
    const Tag = tag as React.ElementType;
    const props: Record<string, unknown> = { key: i, ...attr };
    if (child && child.length > 0) {
      return <Tag {...props}>{renderIconChildren(child)}</Tag>;
    }
    return <Tag {...props} />;
  });
}

function IconGrid({
  icons,
  onSelect,
}: {
  icons: IconEntry[];
  onSelect: (icon: IconEntry) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(icons.length / COLUMNS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * COLUMNS;
          const rowIcons = icons.slice(startIdx, startIdx + COLUMNS);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full grid-cols-6 gap-1 px-1"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowIcons.map((icon) => {
                const [name, data] = icon;
                return (
                  <button
                    key={name}
                    onClick={() => onSelect(icon)}
                    className="flex flex-col items-center justify-center gap-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    title={name}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox={data.attr.viewBox || "0 0 24 24"}
                      fill={data.attr.fill}
                      stroke={data.attr.stroke}
                      strokeWidth={data.attr.strokeWidth}
                      strokeLinecap={
                        data.attr.strokeLinecap as
                          | "round"
                          | "butt"
                          | "square"
                          | undefined
                      }
                      strokeLinejoin={
                        data.attr.strokeLinejoin as
                          | "round"
                          | "miter"
                          | "bevel"
                          | undefined
                      }
                    >
                      {renderIconChildren(data.child)}
                    </svg>
                    <span className="w-full truncate text-center text-[10px] leading-tight">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExamplesDialog({
  onSelect,
}: {
  onSelect: (svgCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [icons, setIcons] = useState<IconEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeLibrary, setActiveLibrary] = useState<string>("");
  const iconCache = useRef<Map<string, IconEntry[]>>(new Map());

  // Load manifest on first open
  useEffect(() => {
    if (!open || manifest.length > 0) return;
    fetch("/data/icons/manifest.json")
      .then((r) => r.json())
      .then((data: ManifestEntry[]) => {
        setManifest(data);
        if (data.length > 0 && !activeLibrary) {
          setActiveLibrary(data[0]!.id);
        }
      })
      .catch(console.error);
  }, [open, manifest.length, activeLibrary]);

  // Load icons for active library
  useEffect(() => {
    if (!activeLibrary) return;

    const cached = iconCache.current.get(activeLibrary);
    if (cached) {
      setIcons(cached);
      return;
    }

    setLoading(true);
    fetch(`/data/icons/${activeLibrary}.json`)
      .then((r) => r.json())
      .then((data: IconEntry[]) => {
        iconCache.current.set(activeLibrary, data);
        setIcons(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeLibrary]);

  const filtered = useMemo(() => {
    if (!search) return icons;
    const q = search.toLowerCase();
    return icons.filter(([name]) => name.includes(q));
  }, [icons, search]);

  const handleSelect = useCallback(
    (icon: IconEntry) => {
      const svg = iconDataToSvg(icon[1]);
      onSelect(svg);
      setOpen(false);
      setSearch("");
    },
    [onSelect],
  );

  const handleLibraryChange = useCallback((id: string) => {
    setActiveLibrary(id);
    setSearch("");
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex gap-2">
          <BookOpen className="h-4 w-4" />
          Examples
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[80vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Icon Examples</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <div className="flex w-48 shrink-0 flex-col overflow-y-auto border-r bg-muted/30 p-2">
            <span className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Libraries
            </span>
            {manifest.map((lib) => (
              <button
                key={lib.id}
                onClick={() => handleLibraryChange(lib.id)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  activeLibrary === lib.id
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span className="block truncate">{lib.name}</span>
                <span className="text-[10px] opacity-60">
                  {lib.count.toLocaleString()} icons
                </span>
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="pl-9"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {filtered.length.toLocaleString()} icons
              </p>
            </div>

            {loading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading icons...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No icons found
              </div>
            ) : (
              <IconGrid icons={filtered} onSelect={handleSelect} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
