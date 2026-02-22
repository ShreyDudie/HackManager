import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                    <div className="glass-card max-w-md p-12">
                        <div className="mb-6 flex justify-center">
                            <div className="rounded-full bg-destructive/10 p-4">
                                <ShieldAlert className="h-12 w-12 text-destructive" />
                            </div>
                        </div>
                        <h1 className="mb-2 font-display text-2xl font-bold">Something went wrong</h1>
                        <p className="mb-8 text-sm text-muted-foreground">
                            An unexpected error occurred. We've been notified and are working on it.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center justify-center gap-2 btn-primary-glow px-6 py-2.5 font-bold"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Try Again
                            </button>
                            <Link
                                to="/"
                                onClick={() => this.setState({ hasError: false })}
                                className="flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-secondary"
                            >
                                <Home className="h-4 w-4" />
                                Back to Home
                            </Link>
                        </div>
                        {process.env.NODE_ENV === "development" && (
                            <div className="mt-8 text-left">
                                <p className="text-[10px] font-mono text-destructive bg-destructive/5 p-2 rounded overflow-auto max-h-32">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
