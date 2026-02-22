import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Zap, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/hackathons", label: "Hackathons" },
  ];

  const dashboardLink = user
    ? user.role === "admin"
      ? "/admin"
      : user.role === "judge"
      ? "/judge"
      : "/student"
    : null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Zap className="h-6 w-6 text-primary" />
          <span className="gradient-text">HackManager</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium transition-colors ${
                isActive(l.to) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated && dashboardLink && (
            <Link
              to={dashboardLink}
              className={`text-sm font-medium transition-colors ${
                location.pathname.startsWith(dashboardLink) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Dashboard
            </Link>
          )}
          {isAuthenticated ? (
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          ) : (
            <Link to="/role-select" className="btn-primary-glow text-sm">
              Login
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/50 bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-3 px-4 py-4">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              ))}
              {isAuthenticated && dashboardLink && (
                <Link to={dashboardLink} onClick={() => setMobileOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
              )}
              {isAuthenticated ? (
                <button onClick={() => { logout(); setMobileOpen(false); }} className="text-left text-sm text-muted-foreground">
                  Logout
                </button>
              ) : (
                <Link to="/role-select" onClick={() => setMobileOpen(false)} className="btn-primary-glow text-center text-sm">
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
