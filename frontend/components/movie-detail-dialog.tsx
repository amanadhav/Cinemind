"use client";

import { useEffect, useState } from "react";
import { Clock, Sparkles, Bookmark } from "lucide-react";

import { api, MovieDetail } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from "./watchlist-drawer";

interface MovieDetailDialogProps {
  movieId?: number | null;
  title?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional: called with a title when the user clicks "Find Similar".
  onFindSimilar?: (title: string) => void;
}

export function MovieDetailDialog({
  movieId,
  title,
  open,
  onOpenChange,
  onFindSimilar,
}: MovieDetailDialogProps) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    if (!detail) return;
    setInWatchlist(isInWatchlist(detail.title));

    function handleSync() {
      if (detail) setInWatchlist(isInWatchlist(detail.title));
    }

    window.addEventListener("cinemind-watchlist-change", handleSync);
    return () => window.removeEventListener("cinemind-watchlist-change", handleSync);
  }, [detail]);

  const toggleWatchlist = () => {
    if (!detail) return;
    if (inWatchlist) {
      removeFromWatchlist(detail.title);
    } else {
      addToWatchlist({
        title: detail.title,
        poster_url: detail.poster_url,
        movie_id: detail.movie_id,
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    if (movieId == null && !title) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    const request =
      movieId != null
        ? api.movieDetail(movieId)
        : api.movieDetailByTitle(title as string);
    request
      .then(setDetail)
      .catch(() => setError("Couldn't load movie details."))
      .finally(() => setLoading(false));
  }, [open, movieId, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        {loading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && <p className="p-6 text-sm text-destructive">{error}</p>}

        {detail && !loading && (
          <div>
            <div className="relative h-56 w-full bg-zinc-900">
              <MoviePoster
                src={detail.backdrop_url || detail.poster_url}
                alt={detail.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">
                    {detail.title}
                    {detail.year ? (
                      <span className="ml-2 font-normal text-white/70">
                        ({detail.year})
                      </span>
                    ) : null}
                  </DialogTitle>
                </DialogHeader>
              </div>
            </div>

            <div className="space-y-4 p-6 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {detail.runtime ? (
                  <span className="flex items-center gap-1 rounded-md border border-gold/40 px-2 py-0.5 text-xs text-gold">
                    <Clock className="h-3 w-3" /> {detail.runtime} min
                  </span>
                ) : null}
                {detail.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-md border border-gold/40 px-2 py-0.5 text-[11px] text-gold"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {detail.tagline ? (
                <p className="text-sm italic text-muted-foreground">
                  {detail.tagline}
                </p>
              ) : null}

              {detail.overview ? (
                <p className="text-sm leading-relaxed text-foreground/80">
                  {detail.overview}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No description available.
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {onFindSimilar && (
                  <Button
                    className="uppercase tracking-wider shadow-md"
                    onClick={() => {
                      onFindSimilar(detail.title);
                      onOpenChange(false);
                    }}
                  >
                    <Sparkles className="h-4 w-4" /> Find Similar
                  </Button>
                )}
                <Button
                  variant="outline"
                  className={`uppercase tracking-wider transition-all border-border hover:border-gold/30 ${
                    inWatchlist ? "border-gold/50 text-gold bg-gold/5" : ""
                  }`}
                  onClick={toggleWatchlist}
                >
                  <Bookmark className={`h-4 w-4 ${inWatchlist ? "fill-gold text-gold" : "fill-none"}`} />
                  {inWatchlist ? "In Watchlist" : "Add to Watchlist"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
