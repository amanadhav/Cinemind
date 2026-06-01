"use client";

import { AlertCircle, RotateCcw, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  /** When true, show the "server waking up" affordance (timeout case). */
  isTimeout?: boolean;
  /** Optional retry handler; renders a "Try again" button when provided. */
  onRetry?: () => void;
}

// Inline, non-fatal error panel used inside tabs when a data fetch fails.
// Distinct from ErrorBoundary, which catches render-time crashes; this is for
// expected runtime failures (network down, backend asleep, 4xx/5xx).
export function ErrorState({ message, isTimeout, onRetry }: ErrorStateProps) {
  const Icon = isTimeout ? Clock : AlertCircle;
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <Icon className="h-8 w-8 text-destructive" />
      <p className="text-sm text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}
