"use client";

import { useEffect, useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";

import { api, ApiError, PopularMovie, Recommendation, UserRating } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { StarRating } from "@/components/star-rating";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import { ErrorState } from "@/components/error-state";

const MIN_RATINGS = 5;

export function ForYouTab() {
  const [popular, setPopular] = useState<PopularMovie[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(
    null
  );
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const [seedError, setSeedError] = useState<{ message: string; isTimeout: boolean } | null>(
    null
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function loadSeed() {
    setLoadingSeed(true);
    setSeedError(null);
    api
      .popularMovies(20)
      .then(setPopular)
      .catch((e) =>
        setSeedError({
          message:
            e instanceof Error ? e.message : "Couldn't load movies to rate.",
          isTimeout: e instanceof ApiError && e.isTimeout,
        })
      )
      .finally(() => setLoadingSeed(false));
  }

  useEffect(() => {
    loadSeed();
  }, []);

  const ratedCount = Object.values(ratings).filter((r) => r > 0).length;
  const canSubmit = ratedCount >= MIN_RATINGS;

  function setRating(movieId: number, value: number) {
    setRatings((prev) => ({ ...prev, [movieId]: value }));
  }

  async function submit() {
    const payload: UserRating[] = Object.entries(ratings)
      .filter(([, r]) => r > 0)
      .map(([id, r]) => ({ movie_id: Number(id), rating: r }));
    setSubmitting(true);
    setError(null);
    setErrorTimeout(false);
    try {
      const { recommendations } = await api.rate(payload);
      setRecommendations(recommendations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setErrorTimeout(e instanceof ApiError && e.isTimeout);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setRatings({});
    setRecommendations(null);
    setError(null);
    setErrorTimeout(false);
  }

  // ---- Results screen ----
  if (recommendations) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your personalized picks</h2>
            <p className="text-sm text-muted-foreground">
              Computed from {ratedCount} ratings via SVD matrix factorization.
            </p>
          </div>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {recommendations.map((m) => (
            <Card
              key={m.movie_id}
              onClick={() => {
                setDetailId(m.movie_id);
                setDetailOpen(true);
              }}
              className="cursor-pointer overflow-hidden transition-transform hover:scale-[1.03]"
            >
              <div className="aspect-[2/3]">
                <MoviePoster
                  src={m.poster_url}
                  alt={m.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="space-y-2 p-3">
                <p className="line-clamp-2 text-sm font-medium">{m.title}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {topGenre(m.genres)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <MovieDetailDialog
          movieId={detailId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>
    );
  }

  // ---- Rating screen ----
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Rate a few movies to get started</h2>
        <p className="text-sm text-muted-foreground">
          Rate at least {MIN_RATINGS} of these popular movies and we&apos;ll build
          your taste profile.
        </p>
      </div>

      <div className="sticky top-2 z-10 mx-auto flex max-w-md items-center justify-center gap-3 rounded-full border bg-card/90 px-4 py-2 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {ratedCount}/{MIN_RATINGS} rated
        </span>
        <Button onClick={submit} disabled={!canSubmit || submitting} size="sm">
          <Sparkles className="h-4 w-4" />
          {submitting ? "Crunching..." : "Get my recommendations"}
        </Button>
      </div>

      {error && (
        <ErrorState
          message={error}
          isTimeout={errorTimeout}
          onRetry={canSubmit ? submit : undefined}
        />
      )}

      {seedError ? (
        <ErrorState
          message={seedError.message}
          isTimeout={seedError.isTimeout}
          onRetry={loadSeed}
        />
      ) : loadingSeed ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {popular.map((m) => (
            <Card key={m.movie_id} className="overflow-hidden">
              <div className="aspect-[2/3]">
                <MoviePoster
                  src={m.poster_url}
                  alt={m.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="space-y-2 p-3">
                <p className="line-clamp-2 text-xs font-medium">{m.title}</p>
                <StarRating
                  value={ratings[m.movie_id] ?? 0}
                  onChange={(v) => setRating(m.movie_id, v)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// genres come as a pipe-delimited string, e.g. "Comedy|Drama".
function topGenre(genres: string): string {
  const first = (genres || "").split("|")[0]?.trim();
  return first && first !== "(no genres listed)" ? first : "Recommended";
}
