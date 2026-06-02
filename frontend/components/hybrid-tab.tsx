"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Blend } from "lucide-react";

import { api, ApiError, HybridResult, PopularMovie, UserRating } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MoviePoster } from "@/components/movie-poster";
import { StarRating } from "@/components/star-rating";
import { MovieDetailDialog } from "@/components/movie-detail-dialog";
import { ErrorState } from "@/components/error-state";
import { WatchlistButton } from "@/components/watchlist-button";

const MIN_RATINGS = 3;

const SOURCE_STYLES: Record<HybridResult["source"], string> = {
  content: "bg-sky-500/90 text-white",
  collaborative: "bg-emerald-500/90 text-white",
  both: "bg-gold text-black",
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
  const [sourceFilter, setSourceFilter] = useState("All");

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
            <div className="flex w-full items-center bg-[#111] border border-white/10 rounded-xl p-1 shadow-inner focus-within:ring-1 focus-within:ring-white/30 transition-all group">
              <Search className="ml-3 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedMovie(null);
                }}
                onFocus={() => suggestions.length && setShowSuggestions(true)}
                placeholder="e.g. The Matrix..."
                className="flex-1 h-10 bg-transparent px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-[#111] shadow-lg">
                {suggestions.map((title) => (
                  <button
                    key={title}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedMovie(title);
                      setQuery(title);
                      setShowSuggestions(false);
                    }}
                    className="block w-full border-l-2 border-transparent px-4 py-2.5 text-left text-sm transition-colors hover:border-gold hover:bg-accent"
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedMovie && (
            <p className="mt-2 text-sm text-gold">Selected: {selectedMovie}</p>
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
        <Button
          onClick={submit}
          disabled={!canSubmit || submitting}
          size="lg"
          className="uppercase tracking-wider"
        >
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

      {results && results.length > 0 && (() => {
        const filteredResults = results.filter(
          (m) => sourceFilter === "All" || m.source === sourceFilter.toLowerCase()
        );
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border/40 pb-4">
              <span className="text-xs text-muted-foreground mr-2 font-display uppercase tracking-wider">Filter Source:</span>
              {(["All", "Content", "Collaborative", "Both"] as const).map((src) => {
                const colors: Record<string, string> = {
                  All: "bg-secondary text-zinc-400 hover:text-white",
                  Content: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
                  Collaborative: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                  Both: "bg-gold/10 text-gold border border-gold/25",
                };
                const activeColors: Record<string, string> = {
                  All: "bg-zinc-700 text-white shadow",
                  Content: "bg-sky-500 text-white shadow",
                  Collaborative: "bg-emerald-500 text-white shadow",
                  Both: "bg-gold text-black shadow",
                };
                
                const active = sourceFilter === src;
                return (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(src)}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                      active ? activeColors[src] : colors[src]
                    }`}
                  >
                    {src}
                  </button>
                );
              })}
            </div>
            
            {filteredResults.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No hybrid recommendations match the selected filter.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredResults.map((m, i) => (
                  <div
                    key={m.title}
                    onClick={() => {
                      setDetailTitle(m.title);
                      setDetailOpen(true);
                    }}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="group relative aspect-[2/3] animate-fade-in-up cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card transition-all duration-300 hover:scale-105 hover:border-gold/50 hover:shadow-[0_0_25px_-4px_rgba(245,158,11,0.45)]"
                  >
                    <WatchlistButton title={m.title} posterUrl={m.poster_url} />
                    <MoviePoster
                      src={m.poster_url}
                      alt={m.title}
                      className="h-full w-full object-cover"
                    />
                    <span
                      className={`absolute left-2 top-2 z-10 rounded px-2 py-0.5 text-[10px] font-semibold ${SOURCE_STYLES[m.source]}`}
                    >
                      {SOURCE_LABELS[m.source]}
                    </span>
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/30 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <p className="line-clamp-3 text-sm font-medium text-white">
                        {m.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <MovieDetailDialog
        title={detailTitle}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
