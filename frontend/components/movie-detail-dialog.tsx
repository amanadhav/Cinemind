"use client";

import { useEffect, useState } from "react";
import { Clock, Sparkles } from "lucide-react";

import { api, MovieDetail } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";

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
            <div className="relative h-48 w-full bg-zinc-800">
              <MoviePoster
                src={detail.backdrop_url || detail.poster_url}
                alt={detail.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>

            <div className="space-y-4 p-6 pt-2">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {detail.title}
                  {detail.year ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      ({detail.year})
                    </span>
                  ) : null}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                {detail.runtime ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {detail.runtime} min
                  </span>
                ) : null}
                {detail.genres.map((g) => (
                  <Badge key={g} variant="secondary" className="text-[10px]">
                    {g}
                  </Badge>
                ))}
              </div>

              {detail.tagline ? (
                <p className="text-sm italic text-muted-foreground">
                  {detail.tagline}
                </p>
              ) : null}

              {detail.overview ? (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {detail.overview}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No description available.
                </p>
              )}

              {onFindSimilar && (
                <Button
                  onClick={() => {
                    onFindSimilar(detail.title);
                    onOpenChange(false);
                  }}
                >
                  <Sparkles className="h-4 w-4" /> Find Similar
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
