"use client";

import { Component, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (process.env.NODE_ENV === "production") {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[60dvh] items-center justify-center px-6">
          <div className="max-w-md rounded-lg border border-line bg-surface p-8 text-center">
            <WarningCircle
              size={32}
              weight="duotone"
              className="mx-auto text-danger"
            />
            <h2 className="mt-4 text-xl font-medium tracking-tight">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-muted">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-accent-foreground transition-all hover:bg-accent-hover"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}