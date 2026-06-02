"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";

import { api, ApiError, MovieCard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import { ErrorState } from "@/components/error-state";
import { WatchlistButton } from "@/components/watchlist-button";

interface DiscoverTabProps {
  initialQuery?: string;
  onClearInitialQuery?: () => void;
}

export function DiscoverTab({ initialQuery, onClearInitialQuery }: DiscoverTabProps) {
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
  // Flag to skip the autocomplete fetch when a suggestion was just selected.
  const skipNextFetch = useRef(false);

  // Debounced autocomplete against /api/search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    // Skip fetch if query was set by clicking a suggestion.
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
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

  // Load initial query from spotlight seed if provided.
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      runSearch(initialQuery);
      onClearInitialQuery?.();
    }
  }, [initialQuery, onClearInitialQuery]);

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

  const handleSearch = () => runSearch(query);

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-xl">
        <div ref={boxRef} className="relative">
          <div className="relative mx-auto w-full flex items-center bg-[#111] border border-white/10 rounded-xl p-1 shadow-inner focus-within:ring-1 focus-within:ring-white/30 transition-all group">
            <Search className="absolute left-4 h-5 w-5 text-white/40 group-focus-within:text-white transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Search a movie you like..."
              className="flex-1 h-12 bg-transparent pl-12 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button 
              onClick={handleSearch}
              disabled={query.trim().length < 2 || loading}
              className="flex h-10 w-16 items-center justify-center rounded-lg bg-[#8C8C8C] hover:bg-[#A0A0A0] transition-colors ml-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-[#1a1a1a]" /> : <Search className="h-5 w-5 text-[#1a1a1a]" />}
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl backdrop-blur-xl">
              {suggestions.map((title, idx) => (
                <button
                  key={title}
                  // Use onMouseDown + preventDefault so the Input never loses
                  // focus in a way that re-triggers onFocus → setShowSuggestions.
                  // This means a single click reliably selects and closes.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    skipNextFetch.current = true;
                    setShowSuggestions(false);
                    setSuggestions([]);
                    setQuery(title);
                    runSearch(title);
                  }}
                  className={`block w-full px-5 py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:text-white text-zinc-300 ${
                    idx !== suggestions.length - 1 ? "border-b border-white/5" : ""
                  }`}
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
        <section className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="whitespace-nowrap text-lg font-semibold tracking-wide">
              Your Recommendations
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-gold/60 to-transparent" />
          </div>
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
        </section>
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {movies.map((m, i) => (
        <div
          key={m.title}
          onClick={() => onSelect?.(m.title)}
          style={{ animationDelay: `${i * 50}ms` }}
          className="group relative aspect-[2/3] animate-fade-in-up cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card transition-all duration-300 hover:scale-105 hover:border-gold/50 hover:shadow-[0_0_25px_-4px_rgba(245,158,11,0.45)]"
        >
          <WatchlistButton title={m.title} posterUrl={m.poster_url} />
          <MoviePoster
            src={m.poster_url}
            alt={m.title}
            className="h-full w-full object-cover transition-transform duration-300"
          />
          {m.badge && (
            <span className="absolute left-2 top-2 z-10 rounded bg-gold px-2 py-0.5 text-[11px] font-semibold text-black shadow">
              {m.badge}
            </span>
          )}
          {/* Hover overlay: dark gradient + title from the bottom. */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/30 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <p className="line-clamp-3 text-sm font-medium text-white">
              {m.title}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PosterGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
      ))}
    </div>
  );
}

export { MovieGrid, PosterGridSkeleton };
