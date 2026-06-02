"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from "./watchlist-drawer";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  title: string;
  posterUrl: string;
  movieId?: number | null;
  className?: string;
}

export function WatchlistButton({ title, posterUrl, movieId, className }: WatchlistButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isInWatchlist(title));

    function handleSync() {
      setActive(isInWatchlist(title));
    }

    window.addEventListener("cinemind-watchlist-change", handleSync);
    return () => window.removeEventListener("cinemind-watchlist-change", handleSync);
  }, [title]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      removeFromWatchlist(title);
    } else {
      addToWatchlist({ title, poster_url: posterUrl, movie_id: movieId });
    }
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/80",
        active ? "text-gold bg-black/80 border border-gold/30" : "text-white/70 hover:text-white border border-white/10",
        className
      )}
      title={active ? "Remove from Watchlist" : "Add to Watchlist"}
    >
      <Bookmark className={cn("h-4.5 w-4.5", active ? "fill-gold" : "fill-none")} />
    </button>
  );
}
