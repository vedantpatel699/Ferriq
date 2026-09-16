import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <>
          <h1>This page could not be displayed</h1>
          <p role="alert">
            Try another page or reload. Saved browser data have not been
            deleted. Reloading discards unsaved changes.
          </p>
          <button onClick={() => window.location.reload()}>
            Reload website
          </button>
        </>
      );
    return this.props.children;
  }
}
export function PageBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary key={location.pathname}>{children}</Boundary>;
}
