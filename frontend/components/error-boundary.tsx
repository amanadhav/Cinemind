"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  /** Friendly label for the section being guarded, e.g. "For You". */
  label?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

// React error boundaries must be class components: only getDerivedStateFromError
// and componentDidCatch can intercept render-time exceptions in the subtree.
// This keeps one failing tab from blanking the whole app and offers a retry.
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message:
        error instanceof Error ? error.message : "Something unexpected happened.",
    };
  }

  componentDidCatch(error: unknown) {
    // Surface the detail in the console for debugging; in a real deployment
    // this is where an error-reporting service (Sentry, etc.) would be called.
    console.error("ErrorBoundary caught an error:", error);
  }

  private reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <p className="font-semibold">
            {this.props.label
              ? `The ${this.props.label} section hit a snag.`
              : "Something went wrong."}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {this.state.message}
          </p>
        </div>
        <Button variant="outline" onClick={this.reset}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }
}
