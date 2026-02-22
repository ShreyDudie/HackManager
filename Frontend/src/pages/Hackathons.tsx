// =============================================================================
// Hackathons.tsx — Patch 11: Separate external hackathons section
// Admin-created hackathons and Unstop-simulated hackathons never mixed.
// =============================================================================

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Users, ArrowRight, Search, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { getHackathons, getRegistrations, getExternalHackathons, type Hackathon, type ExternalHackathon } from "@/lib/storage";

export default function Hackathons() {
  const [search, setSearch] = useState("");
  const [adminHackathons, setAdminHackathons] = useState<Hackathon[]>([]);
  const [externalHackathons, setExternalHackathons] = useState<ExternalHackathon[]>([]);

  useEffect(() => {
    setAdminHackathons(getHackathons());
    setExternalHackathons(getExternalHackathons());
  }, []);

  const filtered = adminHackathons.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    (h.theme || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pt-16">
      <div className="container px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="mb-2 font-display text-3xl font-bold">Hackathons</h1>
          <p className="mb-8 text-muted-foreground">Browse and join upcoming events.</p>

          <div className="relative mb-8 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search by name or theme..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* ── Admin-Created Hackathons ── */}
          <section className="mb-12">
            <h2 className="mb-4 font-display text-xl font-semibold">Hosted Hackathons</h2>
            {filtered.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground text-sm">
                {adminHackathons.length === 0
                  ? "No hackathons hosted yet. Check back soon."
                  : `No hackathons matching "${search}"`}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((h, i) => {
                  const teamCount = getRegistrations(h.id).length || h.teams || 0;
                  return (
                    <motion.div key={h.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="glass-card-hover flex flex-col p-6">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">{h.theme || "General"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.status === "Open" || h.status === "Ongoing" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {h.status}
                        </span>
                      </div>
                      <h3 className="mb-1 font-display text-lg font-semibold">{h.name}</h3>
                      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{h.desc || h.description || "No description"}</p>
                      <div className="mb-4 space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{h.date || `${h.startDate} — ${h.endDate}`}</div>
                        <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{teamCount} teams</div>
                      </div>
                      <Link to="/role-select"
                        className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 py-2 text-sm font-medium text-primary hover:bg-primary/10">
                        Join Now <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Patch 11: External (Unstop-simulated) Hackathons — separate section ── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold">From Unstop</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"></span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">External hackathons from the platform ecosystem (read-only).</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {externalHackathons.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass-card border-border/30 p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-accent">{h.theme}</span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">External</span>
                  </div>
                  <h3 className="mb-1 font-display font-semibold">{h.name}</h3>
                  <p className="mb-1 text-xs text-muted-foreground">by {h.organizer}</p>
                  <div className="mb-3 text-xs text-muted-foreground space-y-0.5">
                    <div>🏆 Prize: {h.prizePool}</div>
                    <div>📅 Deadline: {new Date(h.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                  <a href={h.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-accent/30 py-2 text-sm font-medium text-accent hover:bg-accent/10">
                    View on Platform <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </motion.div>
              ))}
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}