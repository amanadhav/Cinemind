"use client";

import { useEffect, useState } from "react";
import { Sparkles, BrainCircuit } from "lucide-react";
import { PopularMovie } from "@/lib/api";

interface TasteProfileProps {
  ratings: Record<number, number>;
  movies: PopularMovie[];
}

interface GenreStat {
  genre: string;
  percentage: number;
  score: number;
  count: number;
}

export function TasteProfile({ ratings, movies }: TasteProfileProps) {
  const [stats, setStats] = useState<GenreStat[]>([]);

  useEffect(() => {
    const ratedEntries = Object.entries(ratings).filter(([, rating]) => rating > 0);
    if (ratedEntries.length === 0) {
      setStats([]);
      return;
    }

    const genreScores: Record<string, number> = {};
    const genreCounts: Record<string, number> = {};
    let totalScore = 0;

    ratedEntries.forEach(([idStr, rating]) => {
      const mid = Number(idStr);
      // Find the movie object to get its genres
      const movie = movies.find((m) => m.movie_id === mid);
      if (!movie || !movie.genres) return;

      const genreList = movie.genres
        .split("|")
        .map((g) => g.trim())
        .filter((g) => g && g !== "(no genres listed)");

      genreList.forEach((genre) => {
        // Higher ratings carry more weight (e.g. 5 stars = 5 weight, 1 star = 1 weight)
        const weight = rating;
        genreScores[genre] = (genreScores[genre] || 0) + weight;
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        totalScore += weight;
      });
    });

    if (totalScore === 0) {
      setStats([]);
      return;
    }

    const compiledStats = Object.keys(genreScores).map((genre) => {
      const score = genreScores[genre];
      const count = genreCounts[genre];
      return {
        genre,
        score,
        count,
        percentage: Math.round((score / totalScore) * 100),
      };
    });

    // Sort by score descending, then count descending
    compiledStats.sort((a, b) => b.score - a.score || b.count - a.count);

    setStats(compiledStats.slice(0, 5)); // Keep top 5 genres
  }, [ratings, movies]);

  if (stats.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-5 flex flex-col items-center justify-center text-center text-muted-foreground border border-border/40">
        <BrainCircuit className="h-8 w-8 text-zinc-600 mb-2" />
        <p className="text-xs">Your Taste Profile will appear as you rate movies.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-5 border border-border/40 space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Sparkles className="h-4.5 w-4.5 text-gold fill-gold/15" />
        <h3 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">
          Your Taste Profile
        </h3>
      </div>

      <div className="space-y-3.5">
        {stats.map((stat, idx) => {
          // Curated colors for top genres for a rich HSL feel
          const colors = [
            "from-gold to-amber-500",
            "from-pink-500 to-rose-500",
            "from-sky-500 to-indigo-500",
            "from-emerald-500 to-teal-500",
            "from-violet-500 to-purple-500",
          ];
          const colorClass = colors[idx % colors.length];

          return (
            <div key={stat.genre} className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-200">{stat.genre}</span>
                <span className="text-zinc-400 tabular-nums">{stat.percentage}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-500`}
                  style={{ width: `${stat.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
