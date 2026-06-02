"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RotateCcw, Search } from "lucide-react";

import { api, ApiError, PopularMovie, Recommendation, UserRating } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { StarRating } from "@/components/star-rating";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import { ErrorState } from "@/components/error-state";

const MIN_RATINGS = 5;

export function ForYouTab() {
  const [popular, setPopular] = useState<PopularMovie[]>([]);
  const [extraMovies, setExtraMovies] = useState<PopularMovie[]>([]);
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

  // Search-to-add state for the rating screen.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PopularMovie[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Explore mode (triggered by Enter / search icon): two-section results.
  const [explore, setExplore] = useState<{
    query: string;
    matches: PopularMovie[];
    similar: PopularMovie[];
  } | null>(null);
  const [exploring, setExploring] = useState(false);

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

  // Debounced movie search to add titles beyond the popular seed grid.
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const found = await api.searchMovies(query.trim(), 8);
        setSuggestions(found);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close the suggestions dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Add a searched movie to the grid so it can be rated. Skips duplicates
  // already shown in the popular seed or previously added. The movie is added
  // unrated — the user sets the stars themselves.
  function addMovie(movie: PopularMovie) {
    setShowSuggestions(false);
    setQuery("");
    setSuggestions([]);
    const known =
      popular.some((m) => m.movie_id === movie.movie_id) ||
      extraMovies.some((m) => m.movie_id === movie.movie_id);
    if (!known) {
      setExtraMovies((prev) => [movie, ...prev]);
    }
  }

  // Submit the query (Enter or search icon): fetch the two-section explore
  // results (matching titles + content-similar titles).
  async function runExplore(q: string) {
    const term = q.trim();
    if (term.length < 2) return;
    setShowSuggestions(false);
    setExploring(true);
    setError(null);
    setErrorTimeout(false);
    try {
      const { matches, similar } = await api.exploreMovies(term);
      setExplore({ query: term, matches, similar });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setErrorTimeout(e instanceof ApiError && e.isTimeout);
    } finally {
      setExploring(false);
    }
  }

  function clearExplore() {
    setExplore(null);
    setQuery("");
    setSuggestions([]);
  }

  // Combined list rendered in the grid: added movies first, then popular.
  // Movies surfaced via explore that the user has rated are also pinned in so
  // their rating persists when they leave explore view.
  const ratedExploreMovies = explore
    ? [...explore.matches, ...explore.similar].filter(
        (m) =>
          (ratings[m.movie_id] ?? 0) > 0 &&
          !popular.some((p) => p.movie_id === m.movie_id) &&
          !extraMovies.some((e) => e.movie_id === m.movie_id)
      )
    : [];
  const ratingGrid = [...ratedExploreMovies, ...extraMovies, ...popular];

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
    setExtraMovies([]);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setExplore(null);
  }

  function openDetail(movieId: number) {
    setDetailId(movieId);
    setDetailOpen(true);
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
          Rate at least {MIN_RATINGS} movies and we&apos;ll build your taste
          profile. Search to add any title, or rate the popular ones below.
        </p>
      </div>

      {/* Search to add any movie, or hit Enter to explore matches + similar. */}
      <div className="mx-auto max-w-md">
        <div ref={searchBoxRef} className="relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runExplore(query);
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              placeholder="Search a movie, e.g. Toy Story — then press Enter"
              className="h-11 pl-9 pr-12"
            />
            <Button
              type="submit"
              size="icon"
              disabled={query.trim().length < 2 || exploring}
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
              aria-label="Search movies"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg">
              {suggestions.map((m) => (
                <button
                  key={m.movie_id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addMovie(m);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  {m.title}
                </button>
              ))}
            </div>
          )}
        </div>
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
      ) : exploring ? (
        <PosterRateSkeleton />
      ) : explore ? (
        /* ---- Explore view: two sections ---- */
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Results for{" "}
              <span className="font-medium text-foreground">
                &ldquo;{explore.query}&rdquo;
              </span>
            </p>
            <Button variant="ghost" size="sm" onClick={clearExplore}>
              <RotateCcw className="h-4 w-4" /> Back to popular
            </Button>
          </div>

          {explore.matches.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">
                Matching &ldquo;{explore.query}&rdquo;
              </h3>
              <RateGrid
                movies={explore.matches}
                ratings={ratings}
                onRate={setRating}
                onOpenDetail={openDetail}
              />
            </section>
          )}

          {explore.similar.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Similar movies</h3>
              <RateGrid
                movies={explore.similar}
                ratings={ratings}
                onRate={setRating}
                onOpenDetail={openDetail}
              />
            </section>
          )}

          {explore.matches.length === 0 && explore.similar.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No movies found for &ldquo;{explore.query}&rdquo;. Try another title.
            </p>
          )}
        </div>
      ) : loadingSeed ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <RateGrid
          movies={ratingGrid}
          ratings={ratings}
          onRate={setRating}
          onOpenDetail={openDetail}
        />
      )}

      <MovieDetailDialog
        movieId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

// genres come as a pipe-delimited string, e.g. "Comedy|Drama".
function topGenre(genres: string): string {
  const first = (genres || "").split("|")[0]?.trim();
  return first && first !== "(no genres listed)" ? first : "Recommended";
}

// A grid of rateable movie cards: poster (click -> detail) + star rating.
function RateGrid({
  movies,
  ratings,
  onRate,
  onOpenDetail,
}: {
  movies: PopularMovie[];
  ratings: Record<number, number>;
  onRate: (movieId: number, value: number) => void;
  onOpenDetail: (movieId: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((m) => (
        <Card key={m.movie_id} className="overflow-hidden">
          <div
            className="aspect-[2/3] cursor-pointer"
            onClick={() => onOpenDetail(m.movie_id)}
          >
            <MoviePoster
              src={m.poster_url}
              alt={m.title}
              className="h-full w-full object-cover transition-opacity hover:opacity-80"
            />
          </div>
          <CardContent className="space-y-2 p-3">
            <p className="line-clamp-2 text-xs font-medium">{m.title}</p>
            <StarRating
              value={ratings[m.movie_id] ?? 0}
              onChange={(v) => onRate(m.movie_id, v)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PosterRateSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
