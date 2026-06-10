// =============================================================================
// AdminDashboard.tsx — Dynamic admin dashboard with delete (Patch 2)
// Confirmation modal before deleting. Cascading delete via storage.ts.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, HelpCircle,
  PlusCircle, Users, Calendar, Search, Trash2, AlertTriangle, QrCode, RotateCcw,
  BarChart3, Activity, ShieldCheck, CheckCircle2, AlertOctagon, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getHackathons,
  getRegistrations,
  deleteHackathon,
  resetSystem,
  getQRStats,
  getQRScanLogs,
  type Hackathon,
} from "@/lib/storage";
import { toast } from "@/hooks/use-toast";

const sidebarItems = [
  { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
  { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
  { to: "/helpline", label: "Helpline", icon: HelpCircle },
];

const statusColors: Record<string, string> = {
  Open: "bg-success/10 text-success",
  Upcoming: "bg-primary/10 text-primary",
  Ongoing: "bg-success/10 text-success",
  Completed: "bg-muted text-muted-foreground",
  "Coming Soon": "bg-primary/10 text-primary",
};

const resultColors: Record<string, string> = {
  valid: "bg-success/10 text-success border-success/20",
  invalid: "bg-destructive/10 text-destructive border-destructive/20",
  duplicate: "bg-warning/10 text-warning border-warning/20",
  expired: "bg-muted text-muted-foreground border-muted/50",
};

export default function AdminDashboard() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"hackathons" | "analytics">("hackathons");
  const [deleteTarget, setDeleteTarget] = useState<Hackathon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    setHackathons(getHackathons());
  }, []);

  // Listen for database sync storage events to update UI in real-time
  useEffect(() => {
    const handleStorageUpdate = () => {
      setHackathons(getHackathons());
    };
    window.addEventListener("storage", handleStorageUpdate);
    return () => window.removeEventListener("storage", handleStorageUpdate);
  }, []);

  const filtered = hackathons.filter((h) => {
    const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : h.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  // Statistics Calculations
  const activeHackathonsCount = hackathons.filter(h => h.status === "Open" || h.status === "Ongoing").length;
  const allRegistrations = getRegistrations();
  const totalTeamsCount = allRegistrations.length;
  const totalParticipantsCount = allRegistrations.reduce((sum, r) => sum + (r.members?.length || 0), 0);
  const verifiedParticipantsCount = allRegistrations.reduce(
    (sum, r) => sum + (r.members?.filter(m => m.verificationStatus).length || 0),
    0
  );
  const verificationRate = totalParticipantsCount > 0
    ? Math.round((verifiedParticipantsCount / totalParticipantsCount) * 100)
    : 0;

  const qrStats = getQRStats();
  const recentLogs = getQRScanLogs().slice(0, 5);

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Admin" />
      <main className="flex-1 p-6 md:p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-1 font-display text-2xl font-bold">Admin Workspace</h1>
              <p className="text-sm text-muted-foreground">Manage and analyze your hackathon events</p>
            </div>
            {/* Fix 5: Reset system button */}
            <button
              onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Fresh Start
            </button>
          </div>

          {/* Navigation Tab Bar */}
          <div className="mb-6 border-b border-border/30">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("hackathons")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === "hackathons"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Hackathons
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === "analytics"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Analytics & Logs
              </button>
            </div>
          </div>

          {activeTab === "hackathons" ? (
            <>
              {/* Search and Filter Row */}
              {hackathons.length > 0 && (
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
                  <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search hackathons..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Upcoming">Upcoming</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(h);
                        }}
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
                <p className="mt-8 text-center text-sm text-muted-foreground">No hackathons matching the filters.</p>
              )}
              {hackathons.length === 0 && (
                <div className="mt-12 text-center">
                  <p className="text-muted-foreground text-sm">No hackathons yet. Click "Add Hackathon" to get started.</p>
                </div>
              )}
            </>
          ) : (
            /* Analytics Dashboard View */
            <div className="space-y-6">
              {/* Core Metrics Row */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <p className="text-xs">Active Hackathons</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{activeHackathonsCount}</p>
                </div>
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    <p className="text-xs">Total Teams Registered</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{totalTeamsCount}</p>
                </div>
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 text-primary animate-pulse" />
                    <p className="text-xs">Total Registered Students</p>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{totalParticipantsCount}</p>
                </div>
                <div className="glass-card p-5 border-success/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-success">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="text-xs">Face Verified Users</p>
                    </div>
                    <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">{verificationRate}%</span>
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold text-success">{verifiedParticipantsCount}</p>
                  <div className="mt-2.5 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${verificationRate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* QR Scan Statistics Row */}
              <div className="glass-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">QR Check-in & Meal Verification Metrics</h2>
                </div>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-secondary/30 p-4 border border-border/55">
                    <p className="text-xs text-muted-foreground font-medium">Total Scan Events</p>
                    <p className="mt-2 text-2xl font-bold">{qrStats.totalScans}</p>
                  </div>
                  <div className="rounded-xl bg-success/5 p-4 border border-success/20">
                    <p className="text-xs text-success font-medium">Valid Entries</p>
                    <p className="mt-2 text-2xl font-bold text-success">{qrStats.validScans}</p>
                  </div>
                  <div className="rounded-xl bg-warning/5 p-4 border border-warning/20">
                    <p className="text-xs text-warning font-medium">Duplicate Rejections</p>
                    <p className="mt-2 text-2xl font-bold text-warning">{qrStats.duplicateAttempts}</p>
                  </div>
                  <div className="rounded-xl bg-destructive/5 p-4 border border-destructive/20">
                    <p className="text-xs text-destructive font-medium">Invalid/Expired Scans</p>
                    <p className="mt-2 text-2xl font-bold text-destructive">{qrStats.invalidScans}</p>
                  </div>
                </div>
              </div>

              {/* Activity logs & Feed */}
              <div className="glass-card overflow-hidden">
                <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Recent Event Activity Feed</h2>
                    <p className="text-[10px] text-muted-foreground">Latest live QR scan check-ins</p>
                  </div>
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                </div>

                {recentLogs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <QrCode className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
                    <p className="text-sm">No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30 text-xs text-muted-foreground">
                          <th className="px-6 py-3 text-left font-medium">Time</th>
                          <th className="px-6 py-3 text-left font-medium">User</th>
                          <th className="px-6 py-3 text-left font-medium">Team</th>
                          <th className="px-6 py-3 text-left font-medium">Action</th>
                          <th className="px-6 py-3 text-left font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {recentLogs.map((log) => (
                          <tr key={log.id} className="text-sm hover:bg-secondary/10 transition-colors">
                            <td className="whitespace-nowrap px-6 py-3 text-xs text-muted-foreground">
                              {new Date(log.scannedAt).toLocaleTimeString()}
                            </td>
                            <td className="px-6 py-3 font-medium truncate max-w-xs">{log.userEmail}</td>
                            <td className="px-6 py-3">{log.teamName}</td>
                            <td className="px-6 py-3">
                              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs capitalize font-medium">{log.tokenType}</span>
                            </td>
                            <td className="px-6 py-3">
                              <Badge className={`${resultColors[log.result]} border shadow-sm`} variant="secondary">
                                {log.result.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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
