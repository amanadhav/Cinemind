// Typed client for the CineMind Flask backend.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface MovieCard {
  title: string;
  poster_url: string;
}

export interface PopularMovie {
  movie_id: number;
  title: string;
  genres: string;
  poster_url: string;
}

export interface Recommendation {
  movie_id: number;
  title: string;
  genres: string;
  score: number;
  poster_url: string;
}

export interface UserRating {
  movie_id: number;
  rating: number;
}

export interface MovieDetail {
  movie_id: number;
  title: string;
  year: string | null;
  genres: string[];
  overview: string;
  runtime: number | null;
  tagline: string;
  poster_url: string;
  backdrop_url: string | null;
}

export interface HybridResult {
  title: string;
  poster_url: string;
  source: "content" | "collaborative" | "both";
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const api = {
  searchTitles: (q: string) =>
    get<string[]>(`/api/search?q=${encodeURIComponent(q)}`),

  recommendByMovie: (movie: string) =>
    post<MovieCard[]>("/api/recommend/content", { movie }),

  popularMovies: (limit = 20) =>
    get<PopularMovie[]>(`/api/movies/popular?limit=${limit}`),

  rate: (ratings: UserRating[]) =>
    post<{ recommendations: Recommendation[] }>("/api/rate", { ratings }),

  recommendForUser: (userId: number) =>
    post<{ recommendations: Recommendation[] }>(
      "/api/recommend/collaborative",
      { user_id: userId }
    ),

  movieDetail: (movieId: number) =>
    get<MovieDetail>(`/api/movie/${movieId}`),

  movieDetailByTitle: (title: string) =>
    get<MovieDetail>(`/api/movie/detail?title=${encodeURIComponent(title)}`),

  recommendHybrid: (movie: string, ratings: UserRating[]) =>
    post<HybridResult[]>("/api/recommend/hybrid", { movie, ratings }),
};
