import {useLocation} from "react-router-dom";
import { useState, useLayoutEffect, useRef, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { WorkspaceNotices } from "../lib/WorkspaceContext";
export function AppShell({ children }: { children: ReactNode }) {
  const location=useLocation();
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    const main = document.getElementById("main-content");
    main?.scrollTo(0, 0);
    const updateTitle = () => { document.title = `${main?.querySelector("h1")?.textContent ?? "Loading"} | Ferriq`; };
    updateTitle();
    const observer = new MutationObserver(updateTitle);
    if (main) observer.observe(main, { childList: true, subtree: true });
    if (previousPath.current !== location.pathname) main?.focus({ preventScroll: true });
    previousPath.current = location.pathname;
    return () => observer.disconnect();
  }, [location.pathname]);
  const [open, setOpen] = useState(false);
  return (
    <div className={"shell" + (open ? " nav-open" : "")}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        className="mobile-menu"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        Menu
      </button>
      <Sidebar onNavigate={() => {
        setOpen(false);
        document.getElementById("main-content")?.focus({ preventScroll: true });
      }} />
      <main id="main-content" className="content" tabIndex={-1}>
        <WorkspaceNotices />
        {children}
      </main>
    </div>
  );
}
