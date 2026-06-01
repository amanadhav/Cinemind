"use client";

import { useState } from "react";

interface MoviePosterProps {
  src: string;
  alt: string;
  className?: string;
}

// Poster image with a graceful fallback to an initial-letter placeholder if
// the TMDB image fails to load.
export function MoviePoster({ src, alt, className }: MoviePosterProps) {
  const [errored, setErrored] = useState(false);
  const initial = alt.trim()[0]?.toUpperCase() ?? "?";

  if (errored || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-3xl font-bold text-zinc-500 ${className ?? ""}`}
      >
        {initial}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
