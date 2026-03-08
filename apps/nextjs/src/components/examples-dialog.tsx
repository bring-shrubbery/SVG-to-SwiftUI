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
import { iconNodesToSvg } from "@/lib/icon-to-svg";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpen, Search } from "lucide-react";

interface IconEntry {
  name: string;
  nodes: [string, Record<string, string>][];
}

const LIBRARIES = [{ id: "lucide", label: "Lucide Icons" }] as const;
const COLUMNS = 6;

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
              {rowIcons.map((icon) => (
                <button
                  key={icon.name}
                  onClick={() => onSelect(icon)}
                  className="flex flex-col items-center justify-center gap-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  title={icon.name}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {icon.nodes.map(([tag, attrs], i) => {
                      const { key, ...rest } = attrs;
                      return (
                        <g
                          key={i}
                          dangerouslySetInnerHTML={{
                            __html: `<${tag} ${Object.entries(rest)
                              .map(([k, v]) => `${k}="${v}"`)
                              .join(" ")} />`,
                          }}
                        />
                      );
                    })}
                  </svg>
                  <span className="w-full truncate text-center text-[10px] leading-tight">
                    {icon.name}
                  </span>
                </button>
              ))}
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
  const [icons, setIcons] = useState<IconEntry[]>([]);
  const [search, setSearch] = useState("");
  const [activeLibrary, setActiveLibrary] = useState<string>("lucide");
  const searchRef = useRef<HTMLInputElement>(null);

  // Load icon data on first open
  useEffect(() => {
    if (!open || icons.length > 0) return;
    fetch("/data/lucide-icons.json")
      .then((r) => r.json())
      .then((data: IconEntry[]) => setIcons(data))
      .catch(console.error);
  }, [open, icons.length]);

  const filtered = useMemo(() => {
    if (!search) return icons;
    const q = search.toLowerCase();
    return icons.filter((icon) => icon.name.includes(q));
  }, [icons, search]);

  const handleSelect = useCallback(
    (icon: IconEntry) => {
      const svg = iconNodesToSvg(icon.nodes);
      onSelect(svg);
      setOpen(false);
      setSearch("");
    },
    [onSelect],
  );

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
          <div className="flex w-44 shrink-0 flex-col border-r bg-muted/30 p-2">
            <span className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Libraries
            </span>
            {LIBRARIES.map((lib) => (
              <button
                key={lib.id}
                onClick={() => setActiveLibrary(lib.id)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  activeLibrary === lib.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                {lib.label}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="pl-9"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {filtered.length} icons
              </p>
            </div>

            {icons.length === 0 ? (
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
