import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X, Zap } from "lucide-react";
import "@/styles/landing.css";

interface LandingNavbarProps {
  dashboardLink: string | null;
  onLogout: () => void;
}

export default function LandingNavbar({
  dashboardLink,
  onLogout,
}: LandingNavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="landing-header"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>
      <nav
        className="landing-container landing-nav"
        aria-label="Main navigation"
      >
        <Link to="/" className="landing-brand" aria-label="HackManager home">
          <span>
            <Zap size={19} fill="currentColor" />
          </span>
          HackManager<span className="brand-period">.</span>
        </Link>
        <button
          className="landing-menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="landing-nav-links"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <div
          id="landing-nav-links"
          className={`landing-nav-links ${open ? "is-open" : ""}`}
        >
          <a href="#how-it-works" onClick={() => setOpen(false)}>
            How it works
          </a>
          <a href="#your-workspace" onClick={() => setOpen(false)}>
            Your workspace
          </a>
          <Link to="/hackathons" onClick={() => setOpen(false)}>
            Hackathons
          </Link>
          <div className="landing-nav-actions">
            {dashboardLink ? (
              <>
                <button
                  onClick={() => {
                    onLogout();
                    setOpen(false);
                  }}
                >
                  Log out
                </button>
                <Link
                  className="landing-button landing-nav-cta"
                  to={dashboardLink}
                >
                  Dashboard <ArrowUpRight size={15} />
                </Link>
              </>
            ) : (
              <>
                <Link to="/role-select">Log in</Link>
                <Link
                  className="landing-button landing-nav-cta"
                  to="/role-select"
                >
                  Get started <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
