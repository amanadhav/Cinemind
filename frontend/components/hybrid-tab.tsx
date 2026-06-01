"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Blend } from "lucide-react";

import { api, ApiError, HybridResult, PopularMovie, UserRating } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { StarRating } from "@/components/star-rating";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import { ErrorState } from "@/components/error-state";

const MIN_RATINGS = 3;

const SOURCE_STYLES: Record<HybridResult["source"], string> = {
  content: "bg-blue-600 text-white",
  collaborative: "bg-green-600 text-white",
  both: "bg-purple-600 text-white",
};

const SOURCE_LABELS: Record<HybridResult["source"], string> = {
  content: "Content",
  collaborative: "Collaborative",
  both: "Both",
};

export function HybridTab() {
  // Movie selection (left column).
  const [query, setQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Rating grid (right column).
  const [popular, setPopular] = useState<PopularMovie[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [loadingSeed, setLoadingSeed] = useState(true);

  // Results.
  const [results, setResults] = useState<HybridResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const [detailTitle, setDetailTitle] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    api
      .popularMovies(10)
      .then(setPopular)
      .catch(() => setError("Couldn't load movies to rate."))
      .finally(() => setLoadingSeed(false));
  }, []);

  // Debounced autocomplete.
  useEffect(() => {
    if (query.trim().length < 2 || query === selectedMovie) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSuggestions(await api.searchTitles(query.trim()));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, selectedMovie]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const ratedCount = Object.values(ratings).filter((r) => r > 0).length;
  const canSubmit = !!selectedMovie && ratedCount >= MIN_RATINGS;

  async function submit() {
    if (!selectedMovie) return;
    const payload: UserRating[] = Object.entries(ratings)
      .filter(([, r]) => r > 0)
      .map(([id, r]) => ({ movie_id: Number(id), rating: r }));
    setSubmitting(true);
    setError(null);
    setErrorTimeout(false);
    try {
      setResults(await api.recommendHybrid(selectedMovie, payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setErrorTimeout(e instanceof ApiError && e.isTimeout);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: movie search */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            1. Pick a movie you love
          </h3>
          <div ref={boxRef} className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedMovie(null);
                }}
                onFocus={() => suggestions.length && setShowSuggestions(true)}
                placeholder="e.g. The Matrix"
                className="h-11 pl-9"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg">
                {suggestions.map((title) => (
                  <button
                    key={title}
                    onClick={() => {
                      setSelectedMovie(title);
                      setQuery(title);
                      setShowSuggestions(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedMovie && (
            <p className="mt-2 text-sm text-primary">Selected: {selectedMovie}</p>
          )}
        </div>

        {/* Right: mini rating grid */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            2. Rate at least {MIN_RATINGS} ({ratedCount} rated)
          </h3>
          {loadingSeed ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {popular.map((m) => (
                <div key={m.movie_id} className="space-y-1">
                  <div className="aspect-[2/3] overflow-hidden rounded-md">
                    <MoviePoster
                      src={m.poster_url}
                      alt={m.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="scale-[0.7] origin-top">
                    <StarRating
                      value={ratings[m.movie_id] ?? 0}
                      onChange={(v) =>
                        setRatings((p) => ({ ...p, [m.movie_id]: v }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={submit} disabled={!canSubmit || submitting} size="lg">
          <Blend className="h-4 w-4" />
          {submitting ? "Blending..." : "Get Hybrid Recommendations"}
        </Button>
      </div>

      {error && (
        <ErrorState
          message={error}
          isTimeout={errorTimeout}
          onRetry={canSubmit ? submit : undefined}
        />
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> Content
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-600" /> Collaborative
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-600" /> Both
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((m) => (
              <Card
                key={m.title}
                onClick={() => {
                  setDetailTitle(m.title);
                  setDetailOpen(true);
                }}
                className="cursor-pointer overflow-hidden transition-transform hover:scale-[1.03]"
              >
                <div className="relative aspect-[2/3]">
                  <MoviePoster
                    src={m.poster_url}
                    alt={m.title}
                    className="h-full w-full object-cover"
                  />
                  <span
                    className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold ${SOURCE_STYLES[m.source]}`}
                  >
                    {SOURCE_LABELS[m.source]}
                  </span>
                </div>
                <CardContent className="p-3">
                  <p className="line-clamp-2 text-sm font-medium">{m.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <MovieDetailDialog
        title={detailTitle}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
