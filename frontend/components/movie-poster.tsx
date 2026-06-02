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

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
      {/* Subtle film frame border overlay: inner glare/reflection + thin dark boundary */}
      <div className="pointer-events-none absolute inset-0 border border-black/30 ring-1 ring-inset ring-white/15" />
    </div>
  );
}
