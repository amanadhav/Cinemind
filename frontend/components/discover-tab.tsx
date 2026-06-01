"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { api, ApiError, MovieCard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import { ErrorState } from "@/components/error-state";

export function DiscoverTab() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<MovieCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [detailTitle, setDetailTitle] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete against /api/search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const titles = await api.searchTitles(query.trim());
        setSuggestions(titles);
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
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function runSearch(movie: string) {
    if (!movie.trim()) return;
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setErrorTimeout(false);
    setLastQuery(movie.trim());
    setResults([]);
    try {
      const recs = await api.recommendByMovie(movie.trim());
      setResults(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setErrorTimeout(e instanceof ApiError && e.isTimeout);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-xl">
        <div ref={boxRef} className="relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length && setShowSuggestions(true)}
                placeholder="Search a movie you like, e.g. Inception"
                className="h-11 pl-9"
              />
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Finding..." : "Recommend"}
            </Button>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg">
              {suggestions.map((title) => (
                <button
                  key={title}
                  onClick={() => {
                    setQuery(title);
                    runSearch(title);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  {title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <ErrorState
          message={error}
          isTimeout={errorTimeout}
          onRetry={lastQuery ? () => runSearch(lastQuery) : undefined}
        />
      )}

      {loading && <PosterGridSkeleton />}

      {!loading && results.length > 0 && (
        <MovieGrid
          movies={results.map((m, i) => ({
            title: m.title,
            poster_url: m.poster_url,
            badge: i === 0 ? "Best match" : `#${i + 1}`,
          }))}
          onSelect={(title) => {
            setDetailTitle(title);
            setDetailOpen(true);
          }}
        />
      )}

      {!loading && !error && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Search for a movie to see similar titles.
        </p>
      )}

      <MovieDetailDialog
        title={detailTitle}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onFindSimilar={(title) => {
          setQuery(title);
          runSearch(title);
        }}
      />
    </div>
  );
}

function MovieGrid({
  movies,
  onSelect,
}: {
  movies: { title: string; poster_url: string; badge?: string }[];
  onSelect?: (title: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((m) => (
        <Card
          key={m.title}
          onClick={() => onSelect?.(m.title)}
          className="cursor-pointer overflow-hidden transition-transform hover:scale-[1.03]"
        >
          <div className="relative aspect-[2/3]">
            <MoviePoster
              src={m.poster_url}
              alt={m.title}
              className="h-full w-full object-cover"
            />
            {m.badge && (
              <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {m.badge}
              </span>
            )}
          </div>
          <CardContent className="p-3">
            <p className="line-clamp-2 text-sm font-medium">{m.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PosterGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export { MovieGrid, PosterGridSkeleton };
