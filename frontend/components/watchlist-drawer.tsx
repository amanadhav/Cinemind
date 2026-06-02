"use client";

import { useEffect, useState } from "react";
import { Bookmark, X, Film, Trash2, ArrowRight } from "lucide-react";
import { MoviePoster } from "@/components/movie-poster";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";

export interface WatchlistItem {
  movie_id?: number | null;
  title: string;
  poster_url: string;
}

const WATCHLIST_EVENT = "cinemind-watchlist-change";

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("cinemind-watchlist") || "[]");
  } catch {
    return [];
  }
}

export function addToWatchlist(item: WatchlistItem) {
  if (typeof window === "undefined") return;
  const list = getWatchlist();
  if (!list.some((x) => x.title.toLowerCase() === item.title.toLowerCase())) {
    list.push(item);
    localStorage.setItem("cinemind-watchlist", JSON.stringify(list));
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  }
}

export function removeFromWatchlist(title: string) {
  if (typeof window === "undefined") return;
  const list = getWatchlist();
  const filtered = list.filter((x) => x.title.toLowerCase() !== title.toLowerCase());
  localStorage.setItem("cinemind-watchlist", JSON.stringify(filtered));
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

export function isInWatchlist(title: string): boolean {
  const list = getWatchlist();
  return list.some((x) => x.title.toLowerCase() === title.toLowerCase());
}

interface WatchlistDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function WatchlistDrawer({ open, onClose }: WatchlistDrawerProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<{ id?: number | null; title: string } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setItems(getWatchlist());

    function handleUpdate() {
      setItems(getWatchlist());
    }

    window.addEventListener(WATCHLIST_EVENT, handleUpdate);
    return () => window.removeEventListener(WATCHLIST_EVENT, handleUpdate);
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed bottom-0 right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-[#0a0a0a]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out animate-fade-in-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-5">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-bold tracking-wide">My Watchlist</h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
              {items.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close watchlist"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
              <Film className="mb-3 h-10 w-10 text-zinc-600 animate-pulse" />
              <p className="text-sm">Your watchlist is empty.</p>
              <p className="text-xs text-zinc-500 mt-1">
                Click the bookmark icon on any movie card to add it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.title}
                  className="group flex gap-4 rounded-lg border border-border/40 bg-card/40 p-3 transition-all hover:border-gold/30 hover:bg-card/70"
                >
                  <div
                    className="relative aspect-[2/3] w-14 shrink-0 cursor-pointer overflow-hidden rounded"
                    onClick={() => {
                      setSelectedMovie({ id: item.movie_id, title: item.title });
                      setDetailOpen(true);
                    }}
                  >
                    <MoviePoster
                      src={item.poster_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between py-1 min-w-0">
                    <div>
                      <h3
                        className="cursor-pointer truncate text-sm font-medium text-white transition-colors hover:text-gold"
                        onClick={() => {
                          setSelectedMovie({ id: item.movie_id, title: item.title });
                          setDetailOpen(true);
                        }}
                      >
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedMovie({ id: item.movie_id, title: item.title });
                          setDetailOpen(true);
                        }}
                        className="flex items-center gap-1 text-[11px] font-medium text-gold hover:underline"
                      >
                        Details <ArrowRight className="h-3 w-3" />
                      </button>
                      <span className="text-zinc-700">|</span>
                      <button
                        onClick={() => removeFromWatchlist(item.title)}
                        className="flex items-center gap-1 text-[11px] font-medium text-destructive hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MovieDetailDialog
        movieId={selectedMovie?.id}
        title={selectedMovie?.title}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
