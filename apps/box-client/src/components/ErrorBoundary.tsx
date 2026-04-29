import { Component, type ErrorInfo, type ReactNode } from "react";
import { logToServer } from "../logger";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logToServer("ERROR", "react.boundary", `${error.name}: ${error.message}`, `${error.stack}\nComponent stack: ${info.componentStack}`);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-card">
            <div className="error-icon">⚠</div>
            <h1 className="error-title">Something broke</h1>
            <p className="error-message">{this.state.error.message}</p>
            <button className="error-reload" onClick={() => window.location.reload()}>Reload</button>
            <p className="error-hint">The error has been logged. Sorry — show this to whoever's running the box.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
