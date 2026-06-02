"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Bookmark, Sparkles } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscoverTab } from "@/components/discover-tab";
import { ForYouTab } from "@/components/for-you-tab";
import { HybridTab } from "@/components/hybrid-tab";
import { HowItWorks } from "@/components/how-it-works";
import { ErrorBoundary } from "@/components/error-boundary";
import { WatchlistDrawer, getWatchlist, addToWatchlist, removeFromWatchlist } from "@/components/watchlist-drawer";
import { MoviePoster } from "@/components/movie-poster";
import { Button } from "@/components/ui/button";

const SPOTLIGHT_MOVIES = [
  {
    title: "Inception",
    year: "2010",
    tagline: "YOUR MIND IS THE SCENE OF THE CRIME.",
    overview: "Cobb, a skilled thief who steals valuable secrets from deep within the subconscious during the dream state, is offered a chance to have his criminal record erased.",
    backdrop: "https://image.tmdb.org/t/p/w1280/8ZcrwwLNfvkrBEGg447875bgF0G.jpg",
    poster: "https://image.tmdb.org/t/p/w500/l9upL7lQ4n2UF19mZ2K6FSvcj2q.jpg"
  },
  {
    title: "Interstellar",
    year: "2014",
    tagline: "MANKIND WAS BORN ON EARTH. IT WAS NEVER MEANT TO DIE HERE.",
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.",
    backdrop: "https://image.tmdb.org/t/p/w1280/xJHokZBLjvjEZ79051675crdrf5.jpg",
    poster: "https://image.tmdb.org/t/p/w500/gEU2Qv4z3eR3v2547as27sl21V1.jpg"
  },
  {
    title: "The Dark Knight",
    year: "2008",
    tagline: "WHY SO SERIOUS?",
    overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations.",
    backdrop: "https://image.tmdb.org/t/p/w1280/nMKdUUue58G7brq7iCs9454eaTk.jpg",
    poster: "https://image.tmdb.org/t/p/w500/qJ2t4EDteUQCbeF42qTz2Jd0cR5.jpg"
  }
];

export default function Home() {
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [activeTab, setActiveTab] = useState("for-you");
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [discoverSeed, setDiscoverSeed] = useState("");

  useEffect(() => {
    setWatchlistCount(getWatchlist().length);
    function handleSync() {
      setWatchlistCount(getWatchlist().length);
    }
    window.addEventListener("cinemind-watchlist-change", handleSync);
    return () => window.removeEventListener("cinemind-watchlist-change", handleSync);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSpotlightIdx((prev) => (prev + 1) % SPOTLIGHT_MOVIES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const activeMovie = SPOTLIGHT_MOVIES[spotlightIdx];

  const handleSpotlightSimilar = (movieTitle: string) => {
    setDiscoverSeed(movieTitle);
    setActiveTab("discover");
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-16">
      {/* Ambient background glows */}
      <div className="absolute left-[15%] top-[10%] h-[400px] w-[400px] bg-gold/5 bg-glow-sphere animate-pulse-slow" />
      <div className="absolute right-[5%] top-[25%] h-[500px] w-[500px] bg-rose-500/5 bg-glow-sphere animate-pulse-slow-reverse" />

      {/* Cinematic Spotlight Banner */}
      <header className="relative w-full h-[520px] bg-zinc-950 overflow-hidden border-b border-border/40">
        {/* Backdrop images with fade transitions */}
        {SPOTLIGHT_MOVIES.map((movie, idx) => (
          <div
            key={movie.title}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === spotlightIdx ? "opacity-40" : "opacity-0"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={movie.backdrop}
              alt={movie.title}
              className="w-full h-full object-cover object-center scale-105"
            />
          </div>
        ))}

        {/* Ambient Dark Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/30" />

        {/* Sprocket Film Strip Decoration (Top) */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="film-sprocket-border opacity-55" />
        </div>

        {/* Content Box */}
        <div className="absolute inset-0 z-10 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-6 flex flex-col md:flex-row gap-8 items-center justify-between">
            <div key={spotlightIdx} className="max-w-2xl space-y-4 md:space-y-5 text-left animate-fade-in-up">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold tracking-wide uppercase">
                  <Clapperboard className="h-3.5 w-3.5" /> Spotlight
                </span>
                <span className="text-xs text-muted-foreground font-semibold">CineMind Spotlight Series</span>
              </div>
              
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white title-glow-gold uppercase">
                {activeMovie.title}
                <span className="ml-3 text-2xl font-normal text-white/50 font-sans">({activeMovie.year})</span>
              </h1>

              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-gold uppercase">
                {activeMovie.tagline}
              </p>

              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-lg line-clamp-3">
                {activeMovie.overview}
              </p>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => handleSpotlightSimilar(activeMovie.title)}
                  className="uppercase tracking-wider font-semibold shadow-lg hover:scale-105 transition-transform"
                >
                  <Sparkles className="h-4 w-4" /> Find Similar
                </Button>
                <button
                  onClick={() => {
                    const active = getWatchlist().some((x) => x.title.toLowerCase() === activeMovie.title.toLowerCase());
                    if (active) {
                      removeFromWatchlist(activeMovie.title);
                    } else {
                      addToWatchlist({ title: activeMovie.title, poster_url: activeMovie.poster });
                    }
                  }}
                  className="flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/35 transition-all hover:scale-105"
                >
                  <Bookmark className="h-4 w-4 text-gold fill-none" /> Watchlist
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center items-center gap-2.5">
          {SPOTLIGHT_MOVIES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSpotlightIdx(idx)}
              className={`h-2 rounded-full transition-all duration-500 ease-out shadow-sm ${
                idx === spotlightIdx ? "w-8 bg-gold shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "w-2.5 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Sprocket Film Strip Decoration (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="film-sprocket-border opacity-55" />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-10 flex justify-center">
            <TabsList className="glass-panel border-border/80 p-1 shadow-xl">
              <TabsTrigger value="for-you" className="font-semibold uppercase tracking-wider text-xs">For You</TabsTrigger>
              <TabsTrigger value="discover" className="font-semibold uppercase tracking-wider text-xs">Discover by Movie</TabsTrigger>
              <TabsTrigger value="mix-it" className="font-semibold uppercase tracking-wider text-xs">Mix It</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="for-you" className="focus-visible:ring-0 focus-visible:ring-offset-0">
            <ErrorBoundary label="For You">
              <ForYouTab />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="discover" className="focus-visible:ring-0 focus-visible:ring-offset-0">
            <ErrorBoundary label="Discover by Movie">
              <DiscoverTab initialQuery={discoverSeed} onClearInitialQuery={() => setDiscoverSeed("")} />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="mix-it" className="focus-visible:ring-0 focus-visible:ring-offset-0">
            <ErrorBoundary label="Mix It">
              <HybridTab />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>

        <section className="mt-16">
          <HowItWorks />
        </section>

        <footer className="mt-16 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          Built with Next.js, shadcn/ui, and a Flask + scikit-learn / SciPy
          backend.
        </footer>
      </div>

      {/* Floating Watchlist Toggle */}
      <button
        onClick={() => setWatchlistOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border border-gold/30 bg-black/80 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-md transition-all hover:scale-105 hover:border-gold/50 hover:bg-black"
      >
        <Bookmark className="h-4 w-4 fill-gold text-gold" />
        Watchlist
        {watchlistCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-black">
            {watchlistCount}
          </span>
        )}
      </button>

      {/* Watchlist Drawer */}
      <WatchlistDrawer open={watchlistOpen} onClose={() => setWatchlistOpen(false)} />
    </main>
  );
}
