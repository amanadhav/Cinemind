"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number; // 0 = unrated, otherwise 1..5
  onChange: (value: number) => void;
}

// Simple 5-star widget built on lucide icons. Supports hover preview and
// click-to-set. Clicking the current rating again clears it.
export function StarRating({ value, onChange }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === star ? 0 : star)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "h-5 w-5 transition-all duration-200",
              star <= active
                ? "fill-gold star-glow-active"
                : "text-zinc-700 hover:text-zinc-500"
            )}
          />
        </button>
      ))}
    </div>
  );
}
