"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RotateCcw, Search, ChevronLeft, ChevronRight } from "lucide-react";

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
import { TasteProfile } from "@/components/taste-profile";
import { WatchlistButton } from "@/components/watchlist-button";

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
  const [genreFilter, setGenreFilter] = useState("All");
  const [sortBy, setSortBy] = useState("relevance");

  // Search-to-add state for the rating screen.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PopularMovie[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth * 0.75
          : scrollLeft + clientWidth * 0.75;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

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
    
    // Smooth scroll to the movie card so user can see it was added
    setTimeout(() => {
      document.getElementById(`movie-${movie.movie_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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

  // Get all unique genres from recommendations
  const allUniqueGenres = recommendations
    ? Array.from(
        new Set(
          recommendations
            .flatMap((m) => (m.genres || "").split("|"))
            .map((g) => g.trim())
            .filter((g) => g && g !== "(no genres listed)")
        )
      ).sort()
    : [];

  // Filter and sort recommendations
  const filteredAndSortedRecs = recommendations
    ? recommendations
        .filter((m) => {
          if (genreFilter === "All") return true;
          return (m.genres || "")
            .split("|")
            .map((g) => g.trim().toLowerCase())
            .includes(genreFilter.toLowerCase());
        })
        .sort((a, b) => {
          if (sortBy === "score") {
            return b.score - a.score;
          }
          if (sortBy === "title") {
            return a.title.localeCompare(b.title);
          }
          return 0; // relevance (keep default SVD ranking)
        })
    : [];

  // ---- Results screen ----
  if (recommendations) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-wide font-display">
              Your Recommendations
            </h2>
            <p className="text-sm text-muted-foreground">
              Computed from {ratedCount} ratings via SVD matrix factorization.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={reset}
            className="shrink-0 uppercase tracking-wider"
          >
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
        </div>

        {/* Filter and Sort bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setGenreFilter("All")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                genreFilter === "All"
                  ? "bg-gold text-black shadow"
                  : "bg-secondary text-zinc-400 hover:text-white"
              }`}
            >
              All
            </button>
            {allUniqueGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setGenreFilter(genre)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  genreFilter === genre
                    ? "bg-gold text-black shadow"
                    : "bg-secondary text-zinc-400 hover:text-white"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-md border border-border bg-[#111] px-2 py-1 text-xs font-medium text-white focus:border-gold focus:ring-1 focus:ring-gold"
            >
              <option value="relevance">Match Relevance</option>
              <option value="score">Rating Score</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </div>

        {filteredAndSortedRecs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            No recommendations match the selected genre.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {filteredAndSortedRecs.map((m, i) => (
              <div
                key={m.movie_id}
                onClick={() => {
                  setDetailId(m.movie_id);
                  setDetailOpen(true);
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group relative aspect-[2/3] animate-fade-in-up cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card transition-all duration-300 hover:scale-105 hover:border-gold/50 hover:shadow-[0_0_25px_-4px_rgba(245,158,11,0.45)]"
              >
                <WatchlistButton title={m.title} posterUrl={m.poster_url} movieId={m.movie_id} />
                <MoviePoster
                  src={m.poster_url}
                  alt={m.title}
                  className="h-full w-full object-cover"
                />
                {/* Hover overlay with title + genre. */}
                <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <p className="line-clamp-3 text-sm font-medium text-white">
                    {m.title}
                  </p>
                  <span className="w-fit rounded border border-gold/50 px-1.5 py-0.5 text-[10px] text-gold">
                    {topGenre(m.genres)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
          Tell us what you&apos;ve seen
        </h2>
        
        <p className="mt-2 text-sm text-zinc-400 max-w-lg mx-auto">
          Rate at least {MIN_RATINGS} movies and we&apos;ll build your taste profile. Search to add any title, or rate the popular ones below.
        </p>
      </div>

      {/* progress panel & taste profile side by side if there are ratings! */}
      <div className="grid gap-6 md:grid-cols-3 items-stretch max-w-4xl mx-auto w-full mt-2 mb-12">
        <div className="md:col-span-2 flex flex-col justify-center min-h-[140px] rounded-xl border border-white/10 bg-[#111] p-6 shadow-xl">
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full h-12 rounded-lg bg-[#8C8C8C] hover:bg-[#A0A0A0] disabled:opacity-50 disabled:hover:bg-[#8C8C8C] transition-colors text-xs font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center justify-center gap-2 mb-4"
          >
            <Sparkles className="h-4 w-4" />
            {submitting ? "Crunching..." : "Get My Recommendations"}
          </button>
          {/* Progress indicator below the button. */}
          <div className="flex w-full items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{
                  width: `${Math.min(100, (ratedCount / MIN_RATINGS) * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-white/50">
              {ratedCount} / {MIN_RATINGS} rated
            </span>
          </div>
        </div>
        <div className="md:col-span-1 rounded-xl border border-white/10 bg-[#111] overflow-hidden flex flex-col">
          <TasteProfile ratings={ratings} movies={ratingGrid} />
        </div>
      </div>

      {/* Search to add any movie, or hit Enter to explore matches + similar. */}
      <div className="mx-auto max-w-md">
        <div ref={searchBoxRef} className="relative">
          <div className="relative mx-auto max-w-2xl flex items-center bg-[#111] border border-white/10 rounded-xl p-1 shadow-inner focus-within:ring-1 focus-within:ring-white/30 transition-all group">
            <Search className="absolute left-4 h-5 w-5 text-white/40 group-focus-within:text-white transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runExplore(query);
              }}
              placeholder="Search a movie..."
              className="flex-1 h-12 bg-transparent pl-12 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button 
              onClick={() => runExplore(query)}
              className="flex h-10 w-12 items-center justify-center rounded-lg bg-[#8C8C8C] hover:bg-[#A0A0A0] transition-colors ml-2"
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-[#1a1a1a]" />
            </button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[60] mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl backdrop-blur-xl">
              {suggestions.map((m, idx) => (
                <button
                  key={m.movie_id}
                  type="button"
                  onClick={() => {
                    setQuery(m.title);
                    runExplore(m.title);
                  }}
                  className={`block w-full px-5 py-3 text-left text-sm font-medium transition-all hover:bg-white/10 hover:text-white text-zinc-300 ${
                    idx !== suggestions.length - 1 ? "border-b border-white/5" : ""
                  }`}
                >
                  {m.title}
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
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-display">Popular Seeds</h3>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Swipe or use arrows to scroll</span>
          </div>
          
          <div className="relative group">
            {/* Film sprocket top border removed */}
            
            {/* Scroll Container */}
            <div 
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 px-4 scrollbar-none scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
            >
              {ratingGrid.map((m) => {
                const rated = (ratings[m.movie_id] ?? 0) > 0;
                return (
                  <div
                    key={m.movie_id}
                    className={`relative w-40 shrink-0 rounded-lg border bg-card/60 transition-all duration-300 hover:scale-105 ${
                      rated
                        ? "border-gold/70 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]"
                        : "border-border/60 hover:border-gold/20"
                    }`}
                  >
                    <WatchlistButton title={m.title} posterUrl={m.poster_url} movieId={m.movie_id} />
                    <div
                      className="aspect-[2/3] cursor-pointer overflow-hidden rounded-t-lg"
                      onClick={() => openDetail(m.movie_id)}
                    >
                      <MoviePoster
                        src={m.poster_url}
                        alt={m.title}
                        className="h-full w-full object-cover transition-opacity hover:opacity-80"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="line-clamp-2 text-[11px] font-medium min-h-[32px] text-zinc-200 leading-tight">{m.title}</p>
                      <div className="scale-[0.8] origin-left">
                        <StarRating
                          value={ratings[m.movie_id] ?? 0}
                          onChange={(v) => setRating(m.movie_id, v)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Film sprocket bottom border removed */}
            
            {/* Left Button */}
            <button
              onClick={() => handleScroll("left")}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white border border-border/80 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg hover:border-gold/50"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5 text-gold" />
            </button>
            
            {/* Right Button */}
            <button
              onClick={() => handleScroll("right")}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-white border border-border/80 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg hover:border-gold/50"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5 text-gold" />
            </button>
          </div>
        </div>
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
      {movies.map((m) => {
        const rated = (ratings[m.movie_id] ?? 0) > 0;
        return (
          <Card
            key={m.movie_id}
            id={`movie-${m.movie_id}`}
            className={`overflow-hidden transition-all relative ${
              rated
                ? "border-gold/70 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]"
                : "border-border/60"
            }`}
          >
            <WatchlistButton title={m.title} posterUrl={m.poster_url} movieId={m.movie_id} />
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
        );
      })}
    </div>
  );
}

function PosterRateSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
