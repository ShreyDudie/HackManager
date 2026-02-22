// =============================================================================
// AdminDashboard.tsx — Dynamic admin dashboard with delete (Patch 2)
// Confirmation modal before deleting. Cascading delete via storage.ts.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import {
  LayoutDashboard, Trophy, Bell, HelpCircle,
  PlusCircle, Users, Calendar, Search, Trash2, AlertTriangle, QrCode, RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getHackathons,
  getRegistrations,
  deleteHackathon,
  resetSystem,
  type Hackathon,
} from "@/lib/storage";
import { toast } from "@/hooks/use-toast";

const sidebarItems = [
  { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
  { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
  { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/admin/announcements", label: "Announcements", icon: Bell },
  { to: "/helpline", label: "Helpline", icon: HelpCircle },
];

const statusColors: Record<string, string> = {
  Open: "bg-success/10 text-success",
  Upcoming: "bg-primary/10 text-primary",
  Ongoing: "bg-success/10 text-success",
  Completed: "bg-muted text-muted-foreground",
  "Coming Soon": "bg-primary/10 text-primary",
};

export default function AdminDashboard() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Hackathon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    setHackathons(getHackathons());
  }, []);

  const filtered = hackathons.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      deleteHackathon(deleteTarget.id);
      setHackathons((prev) => prev.filter((h) => h.id !== deleteTarget.id));
      toast({ title: "Deleted", description: `"${deleteTarget.name}" and all its data removed.` });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Fix 5: Reset entire system
  const handleReset = () => {
    resetSystem();
    setHackathons([]);
    setShowReset(false);
    toast({ title: "System Reset", description: "All hackathon data has been cleared." });
  };

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Admin" />
      <main className="flex-1 p-6 md:p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-1 font-display text-2xl font-bold">My Hackathons</h1>
              <p className="text-sm text-muted-foreground">Manage your hackathon events</p>
            </div>
            {/* Fix 5: Reset system button */}
            <button
              onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Fresh Start
            </button>
          </div>

          {hackathons.length > 0 && (
            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text" placeholder="Search hackathons..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((h) => {
              const regs = getRegistrations(h.id);
              const teamCount = regs.length || h.teams || 0;
              return (
                <div key={h.id} className="glass-card-hover group relative p-6">
                  {/* Delete button — top right */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(h); }}
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Delete hackathon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <Link to={`/admin/hackathon/${h.id}`} className="block">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors pr-6">
                        {h.name}
                      </h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[h.status] || statusColors.Open}`}>
                        {h.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{h.date || `${h.startDate} – ${h.endDate}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{teamCount} teams registered</span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}

            {/* Add Hackathon card */}
            <Link
              to="/admin/hackathon/new"
              className="glass-card flex flex-col items-center justify-center gap-3 border-dashed border-border/50 p-6 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
            >
              <PlusCircle className="h-10 w-10" />
              <span className="font-display text-sm font-semibold">Add Hackathon</span>
            </Link>
          </div>

          {filtered.length === 0 && hackathons.length > 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">No hackathons matching "{search}"</p>
          )}
          {hackathons.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-muted-foreground text-sm">No hackathons yet. Click "Add Hackathon" to get started.</p>
            </div>
          )}
        </motion.div>
      </main>

      {/* ── Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card mx-4 max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <h2 className="font-display text-lg font-bold">Delete Hackathon?</h2>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                You are about to permanently delete:
              </p>
              <p className="mb-4 rounded-lg bg-secondary/50 px-3 py-2 text-sm font-semibold">
                {deleteTarget.name}
              </p>
              <p className="mb-6 text-xs text-destructive">
                ⚠️ This will also delete all registrations, judge assignments,
                announcements, QR tokens, and AI evaluations for this hackathon.
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Permanently"}
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fix 5: Reset Confirmation Modal ── */}
      <AnimatePresence>
        {showReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowReset(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card mx-4 max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <RotateCcw className="h-5 w-5 text-destructive" />
                </div>
                <h2 className="font-display text-lg font-bold">Fresh Start?</h2>
              </div>
              <p className="mb-6 text-sm text-muted-foreground">
                This will <strong className="text-destructive">permanently clear</strong> all:{" "}
                hackathons, registrations, submissions, QR tokens, scan logs,
                judge assignments, notifications, tickets, and AI evaluations.
                <br /><br />
                Your login session will not be affected.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Everything
                </button>
                <button
                  onClick={() => setShowReset(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
