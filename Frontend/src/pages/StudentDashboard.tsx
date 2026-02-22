// =============================================================================
// StudentDashboard.tsx — Multi-hackathon support (Patch 1)
// Student can join multiple hackathons. Switch via hackathon cards.
// Per-member details (name, phone, college) captured at registration.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck,
  PlusCircle, CheckCircle, XCircle, ChevronDown, HelpCircle, Linkedin
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  getHackathons,
  addRegistration,
  findRegistration,
  getUserRegistrations,
  getGitHubSubmission,
  getPPTSubmissions,
  getHackathon,
  removeTeamMember,
  updateTeamMember,
  type Registration,
  type Hackathon,
  type TeamMember,
} from "@/lib/storage";

const sidebarItems = [
  { to: "/student", label: "Overview", icon: LayoutDashboard },
  { to: "/student/ppt-upload", label: "PPT Upload", icon: Upload },
  { to: "/student/github", label: "GitHub Repo", icon: Github },
  { to: "/student/qr", label: "My QR Code", icon: QrCode },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/verify", label: "Face Verify", icon: UserCheck },
  { to: "/student/grievance", label: "Grievance & Support", icon: HelpCircle },
  { to: "/student/linkedin", label: "LinkedIn Post", icon: Linkedin },
];

const statusColors: Record<string, string> = {
  "In Process": "bg-warning/10 text-warning",
  Shortlisted: "bg-primary/10 text-primary",
  Rejected: "bg-destructive/10 text-destructive",
  Verified: "bg-success/10 text-success",
};

export default function StudentDashboard() {
  const { user } = useAuth();

  // All registrations for this user
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  // Currently active hackathon context
  const [activeHackathonId, setActiveHackathonId] = useState<string>("");
  const [activeRegistration, setActiveRegistration] = useState<Registration | null>(null);
  const [activeHackathon, setActiveHackathon] = useState<Hackathon | null>(null);

  // "Join new hackathon" form toggle
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Form state
  const [teamName, setTeamName] = useState("");
  const [selectedHackathonId, setSelectedHackathonId] = useState("");
  const [memberCount, setMemberCount] = useState(1);
  const [members, setMembers] = useState<{ name: string; email: string; phone: string; college: string }[]>([
    { name: user?.name || "", email: user?.email || "", phone: "", college: "" }
  ]);

  // Available hackathons for dropdown (excludes already-joined)
  const [availableHackathons, setAvailableHackathons] = useState<Hackathon[]>([]);

  // Submission statuses for active hackathon
  const [githubSubmitted, setGithubSubmitted] = useState(false);
  const [pptCount, setPptCount] = useState(0);

  // Load all registrations for user
  useEffect(() => {
    if (!user?.email) return;
    const regs = getUserRegistrations(user.email);
    setMyRegistrations(regs);

    // Restore active hackathon from localStorage
    const savedActive = localStorage.getItem("sq_active_hackathon_" + user.email);
    const activeId = savedActive && regs.find((r) => r.hackathonId === savedActive)
      ? savedActive
      : regs[0]?.hackathonId || "";
    setActiveHackathonId(activeId);

    // Load all hackathons for join form (excluding already joined)
    const all = getHackathons();
    const joinedIds = new Set(regs.map((r) => r.hackathonId));
    setAvailableHackathons(all.filter((h) => !joinedIds.has(h.id)));
  }, [user]);

  // When active hackathon changes, load its context
  useEffect(() => {
    if (!activeHackathonId || !user?.email) return;

    const reg = findRegistration(user.email, activeHackathonId);
    setActiveRegistration(reg || null);

    const h = getHackathon(activeHackathonId);
    setActiveHackathon(h || null);

    if (reg) {
      const github = getGitHubSubmission(user.email, activeHackathonId);
      setGithubSubmitted(!!github);
      const ppts = getPPTSubmissions(user.email, activeHackathonId);
      setPptCount(ppts.length);
    }
  }, [activeHackathonId, user]);

  // Switch active hackathon
  const switchHackathon = (id: string) => {
    setActiveHackathonId(id);
    if (user?.email) localStorage.setItem("sq_active_hackathon_" + user.email, id);
  };

  // Add/remove member rows
  const updateMember = (idx: number, field: keyof typeof members[0], value: string) => {
    setMembers((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const addMemberRow = () => {
    if (members.length < 5) setMembers((prev) => [...prev, { name: "", email: "", phone: "", college: "" }]);
  };

  const removeMemberRow = (idx: number) => {
    if (members.length > 1) setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle hackathon registration
  const handleJoinHackathon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !selectedHackathonId) {
      toast({ title: "Required", description: "Select a hackathon and enter team name", variant: "destructive" });
      return;
    }
    if (members.some((m) => !m.name.trim())) {
      toast({ title: "Required", description: "All member names are required", variant: "destructive" });
      return;
    }

    const selectedHackathon = availableHackathons.find((h) => h.id === selectedHackathonId);
    if (!selectedHackathon) return;

    // Build TeamMember objects (Feature 3: includes email for cross-linking)
    const teamMembers: TeamMember[] = members.map((m) => ({
      name: m.name.trim(),
      email: m.email.trim(),
      phone: m.phone.trim(),
      college: m.college.trim(),
      faceEncoding: null,
      verificationStatus: false,
    }));

    const newReg: Registration = {
      id: crypto.randomUUID().slice(0, 8),
      userName: user?.name || user?.email?.split("@")[0] || "",
      userEmail: user?.email || "",
      teamName: teamName.trim(),
      memberNames: members.map((m) => m.name.trim()),
      members: teamMembers,
      hackathonId: selectedHackathonId,
      hackathonName: selectedHackathon.name,
      timestamp: new Date().toISOString(),
      status: "In Process",
      faceImage: null,
      qrTokenUsed: false,
    };

    addRegistration(newReg);

    // Update state
    const updatedRegs = [...myRegistrations, newReg];
    setMyRegistrations(updatedRegs);
    setActiveHackathonId(selectedHackathonId);
    if (user?.email) localStorage.setItem("sq_active_hackathon_" + user.email, selectedHackathonId);

    // Remove from available list
    setAvailableHackathons((prev) => prev.filter((h) => h.id !== selectedHackathonId));

    // Reset form
    setShowJoinForm(false);
    setTeamName("");
    setSelectedHackathonId("");
    setMembers([{ name: user?.name || "", email: user?.email || "", phone: "", college: "" }]);

    toast({ title: "Registered!", description: `Joined ${selectedHackathon.name} as ${teamName.trim()}` });
  };

  // ── No registrations yet ──
  if (myRegistrations.length === 0 && !showJoinForm) {
    return (
      <div className="flex min-h-screen pt-16">
        <DashboardSidebar items={sidebarItems} title="Student" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="glass-card w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <PlusCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 font-display text-xl font-bold">No registrations yet</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Join a hackathon to get started
            </p>
            <button
              onClick={() => setShowJoinForm(true)}
              className="btn-primary-glow w-full py-3 text-sm font-bold"
            >
              JOIN A HACKATHON
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Student" />
      <main className="flex-1 p-6 md:p-8">
        <AnimatePresence mode="wait">
          {showJoinForm ? (
            /* ── Join Form ── */
            <motion.div key="join" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card mx-auto max-w-lg p-8">
                <h2 className="mb-6 font-display text-xl font-bold">Join Another Hackathon</h2>
                {availableHackathons.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">You've already joined all available hackathons!</p>
                    <button onClick={() => setShowJoinForm(false)} className="mt-4 text-primary text-sm hover:underline">
                      Go back
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleJoinHackathon} className="space-y-5">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hackathon</label>
                      <select
                        required value={selectedHackathonId}
                        onChange={(e) => setSelectedHackathonId(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {availableHackathons.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Name</label>
                      <input required type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. CyberKnights"
                        className="mt-1.5 w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                    </div>

                    {/* Per-member fields */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Members</label>
                      {members.map((m, idx) => (
                        <div key={idx} className="mt-2 rounded-lg border border-border/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Member {idx + 1}</span>
                            {idx > 0 && (
                              <button type="button" onClick={() => removeMemberRow(idx)}
                                className="text-xs text-destructive hover:underline">Remove</button>
                            )}
                          </div>
                          <input type="text" placeholder="Full Name *" value={m.name} onChange={(e) => updateMember(idx, "name", e.target.value)}
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                          <input type="email" placeholder="Email *" value={m.email} onChange={(e) => updateMember(idx, "email", e.target.value)}
                            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="tel" placeholder="Phone" value={m.phone} onChange={(e) => updateMember(idx, "phone", e.target.value)}
                              className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                            <input type="text" placeholder="College" value={m.college} onChange={(e) => updateMember(idx, "college", e.target.value)}
                              className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                      ))}
                      {members.length < 5 && (
                        <button type="button" onClick={addMemberRow} className="mt-2 text-xs text-primary hover:underline">
                          + Add member
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary-glow flex-1 py-3 text-sm font-bold">
                        REGISTER
                      </button>
                      <button type="button" onClick={() => setShowJoinForm(false)}
                        className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          ) : (
            /* ── Dashboard ── */
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="font-display text-3xl font-bold">
                    Welcome, {user?.name || user?.email?.split("@")[0]}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Registered in {myRegistrations.length} hackathon{myRegistrations.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {availableHackathons.length > 0 && (
                  <button
                    onClick={() => setShowJoinForm(true)}
                    className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    <PlusCircle className="h-4 w-4" /> Join Another
                  </button>
                )}
              </div>

              {/* Hackathon switcher cards */}
              {myRegistrations.length > 1 && (
                <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myRegistrations.map((r) => (
                    <button
                      key={r.hackathonId}
                      onClick={() => switchHackathon(r.hackathonId)}
                      className={`glass-card rounded-xl p-4 text-left transition-all ${activeHackathonId === r.hackathonId
                        ? "border-primary/50 shadow-lg shadow-primary/10"
                        : "hover:border-primary/20"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{r.hackathonName}</p>
                        {activeHackathonId === r.hackathonId && (
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{r.teamName}</p>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[r.status] || statusColors["In Process"]}`}>
                        {r.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active hackathon dashboard */}
              {activeRegistration && (
                <>
                  <div className="mb-6">
                    <h2 className="font-display text-lg font-semibold">
                      {activeRegistration.hackathonName}
                    </h2>
                    <p className="text-xs text-muted-foreground">Team: {activeRegistration.teamName}</p>
                  </div>

                  {/* Status cards */}
                  <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="glass-card p-5">
                      <p className="text-xs text-muted-foreground">Application Status</p>
                      <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColors[activeRegistration.status]}`}>
                        {activeRegistration.status}
                      </span>
                    </div>
                    <div className="glass-card p-5">
                      <p className="text-xs text-muted-foreground">Team Name</p>
                      <p className="mt-2 font-display text-lg font-semibold">{activeRegistration.teamName}</p>
                    </div>
                    <div className="glass-card p-5">
                      <p className="text-xs text-muted-foreground">GitHub Repo</p>
                      <p className="mt-2 flex items-center gap-1.5 text-sm">
                        {githubSubmitted ? (
                          <><CheckCircle className="h-4 w-4 text-success" /> Submitted</>
                        ) : (
                          <><XCircle className="h-4 w-4 text-destructive" /> Not submitted</>
                        )}
                      </p>
                    </div>
                    <div className="glass-card p-5">
                      <p className="text-xs text-muted-foreground">PPTs Uploaded</p>
                      <p className="mt-2 font-display text-lg font-semibold">{pptCount}</p>
                    </div>
                  </div>

                  {/* Team Members */}
                  {activeRegistration.members && activeRegistration.members.length > 0 && (
                    <div className="glass-card mb-8 p-6">
                      <h3 className="mb-4 font-display text-base font-semibold">Team Members</h3>
                      <div className="divide-y divide-border/30">
                        {activeRegistration.members.map((m, idx) => {
                          const isCreator = activeRegistration.userEmail === user?.email;
                          return (
                            <div key={idx} className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm font-medium">{m.name}{m.email ? ` (${m.email})` : ""}</p>
                                {(m.phone || m.college) && (
                                  <p className="text-xs text-muted-foreground">
                                    {[m.phone, m.college].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${m.verificationStatus ? "text-success" : "text-muted-foreground"}`}>
                                  {m.verificationStatus ? "✓ Verified" : "Pending"}
                                </span>
                                {isCreator && idx > 0 && !m.verificationStatus && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Remove ${m.name} from the team?`)) {
                                        const ok = removeTeamMember(activeRegistration.id, idx);
                                        if (ok) {
                                          setMyRegistrations(getUserRegistrations(user?.email || ""));
                                          toast({ title: "Member removed" });
                                        }
                                      }
                                    }}
                                    className="rounded border border-destructive/30 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="glass-card p-6">
                    <h3 className="mb-6 font-display text-base font-semibold">Event Timeline</h3>
                    <div className="space-y-6">
                      {activeHackathon?.rounds && activeHackathon.rounds.length > 0 ? (
                        activeHackathon.rounds.map((r, i) => {
                          const now = new Date();
                          const deadline = new Date(r.deadline);
                          const isPast = deadline < now;
                          const isCurrent = !isPast && (i === 0 || new Date(activeHackathon.rounds[i - 1]?.deadline) < now);
                          const roundStatus = isPast ? "Completed" : isCurrent ? "In Progress" : "Upcoming";

                          return (
                            <div key={r.id} className="flex items-center gap-4">
                              <div className={`h-3 w-3 shrink-0 rounded-full ${roundStatus === "Completed" ? "bg-success" :
                                roundStatus === "In Progress" ? "bg-primary animate-pulse" :
                                  "bg-muted"
                                }`} />
                              <div className="flex-1">
                                <p className="text-sm font-bold">{r.name}</p>
                                {r.deadline && (
                                  <p className="text-xs text-muted-foreground">
                                    Deadline: {new Date(r.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </p>
                                )}
                              </div>
                              <span className={`text-xs font-bold ${roundStatus === "Completed" ? "text-success" :
                                roundStatus === "In Progress" ? "text-primary" :
                                  "text-muted-foreground"
                                }`}>{roundStatus}</span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No rounds configured yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}