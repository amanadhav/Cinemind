// Typed client for the CineMind Flask backend.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Requests that take longer than this are aborted so the UI can show a
// "taking longer than expected" message instead of hanging forever. The
// Railway free tier can take ~10s to wake from sleep, so the window is roomy.
const REQUEST_TIMEOUT_MS = 15000;

// Error subclass so the UI can distinguish a timeout from a normal failure.
export class ApiError extends Error {
  constructor(message: string, readonly isTimeout = false) {
    super(message);
    this.name = "ApiError";
  }
}

// fetch wrapper that enforces a timeout via AbortController.
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(
        "The server is taking longer than expected. It may be waking up — please try again.",
        true
      );
    }
    throw new ApiError(
      "Couldn't reach the server. Check your connection and try again."
    );
  } finally {
    clearTimeout(timer);
  }
}

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
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  searchTitles: (q: string) =>
    get<string[]>(`/api/search?q=${encodeURIComponent(q)}`),

  recommendByMovie: (movie: string) =>
    post<MovieCard[]>("/api/recommend/content", { movie }),

  popularMovies: (limit = 20) =>
    get<PopularMovie[]>(`/api/movies/popular?limit=${limit}`),

  searchMovies: (q: string, limit = 8) =>
    get<PopularMovie[]>(
      `/api/movies/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  exploreMovies: (q: string) =>
    get<{ matches: PopularMovie[]; similar: PopularMovie[] }>(
      `/api/movies/explore?q=${encodeURIComponent(q)}`
    ),

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
