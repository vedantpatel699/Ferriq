import {useLocation} from "react-router-dom";
import { useState, useLayoutEffect, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
export function AppShell({ children }: { children: ReactNode }) {
  const location=useLocation();
  useLayoutEffect(()=>{document.getElementById("main-content")?.scrollTo(0,0);},[location.pathname]);
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
      <Sidebar onNavigate={() => setOpen(false)} />
      <main id="main-content" className="content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
