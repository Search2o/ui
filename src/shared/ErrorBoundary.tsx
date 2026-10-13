import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<
    {
        children: ReactNode;
        fallback: (error: Error, reset: () => void) => ReactNode;
    },
    { error: Error | null }
> {
    state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Unhandled render error:", error, info.componentStack);
    }

    reset = () => this.setState({ error: null });

    render() {
        const { error } = this.state;
        if (error) return this.props.fallback(error, this.reset);
        return this.props.children;
    }
}
