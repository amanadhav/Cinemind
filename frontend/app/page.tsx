"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Bookmark, Sparkles, Loader2, Search, Bell, User } from "lucide-react";

import { DiscoverTab } from "@/components/discover-tab";
import { ForYouTab } from "@/components/for-you-tab";
import { HybridTab } from "@/components/hybrid-tab";
import { HowItWorks } from "@/components/how-it-works";
import { ErrorBoundary } from "@/components/error-boundary";
import { WatchlistDrawer, getWatchlist, addToWatchlist, removeFromWatchlist } from "@/components/watchlist-drawer";
import { Button } from "@/components/ui/button";

const FAMOUS_100_TITLES = [
  "The Godfather", "The Shawshank Redemption", "Schindler's List", "Raging Bull", "Casablanca",
  "Citizen Kane", "Gone with the Wind", "The Wizard of Oz", "One Flew Over the Cuckoo's Nest", "Lawrence of Arabia",
  "Vertigo", "Psycho", "The Godfather Part II", "On the Waterfront", "Sunset Boulevard",
  "Forrest Gump", "The Sound of Music", "12 Angry Men", "West Side Story", "Star Wars",
  "2001: A Space Odyssey", "E.T. the Extra-Terrestrial", "The Silence of the Lambs", "Chinatown", "Some Like It Hot",
  "It's a Wonderful Life", "Amadeus", "Apocalypse Now", "The Lord of the Rings: The Return of the King", "Gladiator",
  "Titanic", "Saving Private Ryan", "Unforgiven", "Raiders of the Lost Ark", "Rocky",
  "A Streetcar Named Desire", "The Philadelphia Story", "To Kill a Mockingbird", "An American in Paris", "The Best Years of Our Lives",
  "My Fair Lady", "A Clockwork Orange", "Taxi Driver", "Jaws", "Butch Cassidy and the Sundance Kid",
  "The Treasure of the Sierra Madre", "Annie Hall", "Out of Africa", "Goodfellas", "Pulp Fiction",
  "The Matrix", "Inception", "Interstellar", "The Dark Knight", "Avatar",
  "Jurassic Park", "Braveheart", "Dances with Wolves", "The Lion King", "Terminator 2: Judgment Day",
  "Back to the Future", "Blade Runner", "Alien", "Die Hard", "The Shining",
  "A Beautiful Mind", "The Departed", "No Country for Old Men", "Slumdog Millionaire", "The King's Speech",
  "12 Years a Slave", "Birdman", "Spotlight", "Moonlight", "The Shape of Water",
  "Green Book", "Parasite", "Everything Everywhere All at Once", "Oppenheimer", "Fight Club",
  "The Lord of the Rings: The Fellowship of the Ring", "The Lord of the Rings: The Two Towers", "Star Wars: Episode V - The Empire Strikes Back", "Good Will Hunting", "The Truman Show",
  "Catch Me If You Can", "The Social Network", "Whiplash", "Mad Max: Fury Road", "La La Land",
  "Joker", "Spider-Man: Into the Spider-Verse", "Toy Story", "Finding Nemo", "Up",
  "WALL-E", "Inside Out", "Coco", "Spirited Away", "Princess Mononoke"
];

function shuffleArray(array: string[]) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Home() {
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [activeTab, setActiveTab] = useState("for-you");
  const [discoverSeed, setDiscoverSeed] = useState("");

  const [activeSpotlightMovies, setActiveSpotlightMovies] = useState<any[]>([]);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [loadingSpotlight, setLoadingSpotlight] = useState(true);

  useEffect(() => {
    setWatchlistCount(getWatchlist().length);
    function handleSync() {
      setWatchlistCount(getWatchlist().length);
    }
    window.addEventListener("cinemind-watchlist-change", handleSync);
    return () => window.removeEventListener("cinemind-watchlist-change", handleSync);
  }, []);

  useEffect(() => {
    async function initSpotlight() {
      const watchlist = getWatchlist();
      let pool: string[] = [];
      
      if (watchlist.length > 10) {
        pool = watchlist.map((m) => m.title);
      } else {
        pool = FAMOUS_100_TITLES;
      }
      
      const selectedTitles = shuffleArray(pool).slice(0, 5);
      
      try {
        const fetchPromises = selectedTitles.map(async (title) => {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          const res = await fetch(`${baseUrl}/api/movie/detail?title=${encodeURIComponent(title)}`);
          if (!res.ok) throw new Error("Failed to fetch");
          return await res.json();
        });
        const results = await Promise.all(fetchPromises);
        setActiveSpotlightMovies(results);
        setSpotlightIdx(0);
      } catch (err) {
        console.error("Failed to load spotlight movies", err);
      } finally {
        setLoadingSpotlight(false);
      }
    }
    initSpotlight();
  }, []);

  useEffect(() => {
    if (activeSpotlightMovies.length === 0) return;
    const timer = setInterval(() => {
      setSpotlightIdx((prev) => (prev + 1) % activeSpotlightMovies.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeSpotlightMovies.length]);

  const activeMovie = activeSpotlightMovies[spotlightIdx];

  const [touchStart, setTouchStart] = useState<number | null>(null);

  const nextSpotlight = () => {
    if (activeSpotlightMovies.length === 0) return;
    setSpotlightIdx((prev) => (prev + 1) % activeSpotlightMovies.length);
  };

  const prevSpotlight = () => {
    if (activeSpotlightMovies.length === 0) return;
    setSpotlightIdx((prev) => (prev - 1 + activeSpotlightMovies.length) % activeSpotlightMovies.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;
    if (distance > 50) {
      nextSpotlight();
    } else if (distance < -50) {
      prevSpotlight();
    }
    setTouchStart(null);
  };

  const handleSpotlightSimilar = (movieTitle: string) => {
    setDiscoverSeed(movieTitle);
    setActiveTab("discover");
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-16 bg-background">
      {/* Global Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        <div className="flex items-center gap-12">
          {/* Logo */}
          <div className="flex items-center gap-0.5 cursor-pointer z-10" onClick={() => setActiveTab("for-you")}>
            <span className="text-2xl font-black tracking-tight text-white uppercase drop-shadow-md">CineMind</span>
          </div>
        </div>

        {/* Centered Tab Links */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide">
          <button 
            onClick={() => setActiveTab("for-you")} 
            className={`transition-colors ${activeTab === "for-you" ? "text-white" : "text-white/60 hover:text-white"}`}
          >
            For You
          </button>
          <button 
            onClick={() => setActiveTab("discover")} 
            className={`transition-colors ${activeTab === "discover" ? "text-white" : "text-white/60 hover:text-white"}`}
          >
            Discover
          </button>
          <button 
            onClick={() => setActiveTab("mix-it")} 
            className={`transition-colors ${activeTab === "mix-it" ? "text-white" : "text-white/60 hover:text-white"}`}
          >
            Hybrid
          </button>
        </div>

        {/* Right Icons */}
        <div className="flex items-center gap-6 z-10">
          <button onClick={() => setWatchlistOpen(true)} className="relative text-white hover:text-white/80 transition-colors">
            <Bell className="h-5 w-5" />
            {watchlistCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[8px] font-bold text-black border border-black">
                {watchlistCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className="absolute left-[15%] top-[10%] h-[400px] w-[400px] bg-white/5 bg-glow-sphere animate-pulse-slow" />
      <div className="absolute right-[5%] top-[25%] h-[500px] w-[500px] bg-white/5 bg-glow-sphere animate-pulse-slow-reverse" />

      {/* Cinematic Spotlight Header */}
      <header 
        className="relative group w-full h-[70vh] min-h-[500px] md:h-[80vh] md:min-h-[600px] overflow-hidden bg-[#111]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loadingSpotlight ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            {activeSpotlightMovies.map((movie, idx) => (
              <div
                key={movie.title}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === spotlightIdx ? "opacity-100" : "opacity-0"
                }`}
              >
                {movie.backdrop_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={movie.backdrop_url}
                    alt={movie.title}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900" />
                )}
              </div>
            ))}

            {/* Seamless Apple TV style gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent w-full md:w-3/4" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent h-full opacity-60" />

            <div className="absolute inset-0 z-10">
              {activeMovie && (
                <div key={spotlightIdx} className="absolute bottom-20 left-6 md:left-16 max-w-2xl animate-fade-in-up">
                  {/* Top Pill Badge */}
                  <div className="mb-4 inline-flex items-center rounded-full border border-white/30 bg-black/40 px-3 py-1 backdrop-blur-md">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                      CineMind Showcase
                    </span>
                  </div>
                  
                  {/* Massive Wide Title */}
                  <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-[0.15em] mb-3 drop-shadow-lg">
                    {activeMovie.title}
                  </h2>

                  {/* Metadata Line */}
                  <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-white/90 mb-4 drop-shadow-md">
                    {activeMovie.year && <span>{activeMovie.year}</span>}
                    {activeMovie.year && activeMovie.genres?.length > 0 && <span>&middot;</span>}
                    {activeMovie.genres?.length > 0 && (
                      <span>{activeMovie.genres.slice(0, 3).join(" \u00B7 ")}</span>
                    )}
                  </div>

                  {/* Description */}
                  {activeMovie.overview && (
                    <p className="text-sm md:text-base text-zinc-300 leading-relaxed line-clamp-2 max-w-xl mb-8 drop-shadow-md font-medium">
                      {activeMovie.overview}
                    </p>
                  )}

                  {/* Apple Style Buttons */}
                  <div className="flex items-center gap-4">
                    {/* Primary Play/Action Button */}
                    <button
                      onClick={() => handleSpotlightSimilar(activeMovie.title)}
                      className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black hover:bg-white/90 hover:scale-105 transition-all shadow-xl"
                    >
                      <Sparkles className="h-4 w-4 fill-black" /> Find Similar
                    </button>
                    
                    {/* Secondary Watchlist Circular Button */}
                    <button
                      onClick={() => {
                        const active = getWatchlist().some((x) => x.title.toLowerCase() === activeMovie.title.toLowerCase());
                        if (active) {
                          removeFromWatchlist(activeMovie.title);
                        } else {
                          addToWatchlist({ title: activeMovie.title, poster_url: activeMovie.poster_url });
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:scale-105 transition-all shadow-xl"
                      title="Toggle Watchlist"
                    >
                      <Bookmark className={`h-4 w-4 ${getWatchlist().some((x) => x.title.toLowerCase() === activeMovie.title.toLowerCase()) ? "fill-white text-white" : "text-white"}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Navigation Hover Buttons */}
            {/* Left Button (Pointer events auto only on button so it doesn't block movie actions) */}
            <div className="absolute inset-y-0 left-4 z-40 hidden md:flex items-center pointer-events-none">
              <button 
                onClick={prevSpotlight}
                className="pointer-events-auto h-12 w-12 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/60 hover:scale-110 border border-white/20 opacity-0 group-hover:opacity-100 shadow-2xl"
                aria-label="Previous movie"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            </div>
            
            {/* Right Side Click Zone & Button */}
            <div 
              className="absolute inset-y-0 right-0 w-1/3 z-40 hidden md:flex items-center justify-end px-4 cursor-pointer"
              onClick={nextSpotlight}
              aria-label="Next movie"
            >
              <div className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/60 hover:scale-110 border border-white/20 opacity-0 group-hover:opacity-100 shadow-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </div>

            {/* Centered Pagination Dots */}
            <div className="absolute bottom-[100px] left-0 right-0 z-40 flex justify-center items-center gap-3">
              {activeSpotlightMovies.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSpotlightIdx(idx)}
                  className="relative flex items-center justify-center w-4 h-4"
                  aria-label={`Go to slide ${idx + 1}`}
                >
                  <span className={`rounded-full transition-all duration-300 ${
                    idx === spotlightIdx ? "w-1.5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
                  }`} />
                  {idx === spotlightIdx && (
                    <span className="absolute inset-0 rounded-full border-[1.5px] border-[#2997ff] scale-125" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      {/* Main Content Area overlapping the Spotlight banner */}
      <div className="mx-auto max-w-[1400px] px-6 pb-10 relative z-30 -mt-24">
        {activeTab === "for-you" && (
          <ErrorBoundary label="Home">
            <ForYouTab />
          </ErrorBoundary>
        )}
        
        {activeTab === "discover" && (
          <ErrorBoundary label="Movies">
            <DiscoverTab initialQuery={discoverSeed} onClearInitialQuery={() => setDiscoverSeed("")} />
          </ErrorBoundary>
        )}
        
        {activeTab === "mix-it" && (
          <ErrorBoundary label="Series">
            <HybridTab />
          </ErrorBoundary>
        )}

        <section className="mt-20">
          <HowItWorks />
        </section>

        <footer className="mt-16 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          Built with Next.js, shadcn/ui, and a Flask + scikit-learn / SciPy backend.
        </footer>
      </div>

      <WatchlistDrawer open={watchlistOpen} onClose={() => setWatchlistOpen(false)} />
    </main>
  );
}
