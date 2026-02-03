import { Component, type ErrorInfo, type ReactNode } from "react";

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

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {}

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground"
          role="alert"
        >
          <h1 className="text-xl font-semibold mb-2">Algo deu errado</h1>
          <pre className="text-sm text-destructive bg-muted p-4 rounded-lg overflow-auto max-w-full max-h-60">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
