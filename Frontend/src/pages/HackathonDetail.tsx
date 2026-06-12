// =============================================================================
// HackathonDetail.tsx — Patches 4, 7, 9: per-member verify + live judge list
// Patch 4: participants tab shows individual members with verify buttons
// Patch 7: "Add Judge" immediately reflects in local state list
// Patch 9: admin face verification on per-member basis with pixel similarity
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import {
  LayoutDashboard, HelpCircle, ArrowLeft,
  PlusCircle, Trash2, Download, Check, X, Camera, UserCheck, Loader2, QrCode
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  getHackathon,
  updateHackathon,
  getRegistrations,
  updateRegistration,
  updateMemberVerification,
  addNotification,
  getNotifications,
  getJudgeAssignments,
  addJudgeAssignment,
  getAllPPTSubmissions,
  getGitHubSubmissions,
  getJudges,
  addJudge,
  removeJudge,
  isTeamEligible,
  getUserRegistrations,
  getTickets,
  updateTicket,
  addTicketMessage,
  type Hackathon,
  type Registration,
  type Round,
  type EvalCriteria,
  type Notification,
  type JudgeAssignment,
  type Judge,
  type TeamMember,
  type Ticket,
} from "@/lib/storage";

const sidebarItems = [
  { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
  { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
  { to: "/helpline", label: "Helpline", icon: HelpCircle },
];

/* ── Face Pixel Similarity (simple grayscale diff) ── */
async function compareImages(base64A: string, base64B: string): Promise<number> {
  return new Promise((resolve) => {
    const SIZE = 32;
    const canvasA = document.createElement("canvas");
    const canvasB = document.createElement("canvas");
    canvasA.width = canvasB.width = SIZE;
    canvasA.height = canvasB.height = SIZE;
    const ctxA = canvasA.getContext("2d")!;
    const ctxB = canvasB.getContext("2d")!;

    const imgA = new Image();
    const imgB = new Image();
    let loaded = 0;

    const onLoad = () => {
      loaded++;
      if (loaded < 2) return;

      ctxA.drawImage(imgA, 0, 0, SIZE, SIZE);
      ctxB.drawImage(imgB, 0, 0, SIZE, SIZE);
      const dataA = ctxA.getImageData(0, 0, SIZE, SIZE).data;
      const dataB = ctxB.getImageData(0, 0, SIZE, SIZE).data;

      let diff = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const grayA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
        const grayB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];
        diff += Math.abs(grayA - grayB);
      }
      const maxDiff = 255 * SIZE * SIZE;
      const similarity = Math.round((1 - diff / maxDiff) * 100);
      resolve(Math.max(0, Math.min(100, similarity)));
    };

    imgA.onload = imgB.onload = onLoad;
    imgA.src = base64A;
    imgB.src = base64B;
  });
}

export default function HackathonDetail() {
  const { id } = useParams();

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [minTeam, setMinTeam] = useState("2");
  const [maxTeam, setMaxTeam] = useState("5");
  const [criteria, setCriteria] = useState<EvalCriteria[]>([]);
  const [aiWeight, setAiWeight] = useState(50);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [judgeAssignments, setJudgeAssignments] = useState<JudgeAssignment[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Patch 7: live judge list
  const [judges, setJudges] = useState<Judge[]>([]);
  const [judgeEmail, setJudgeEmail] = useState("");
  const [judgeName, setJudgeName] = useState("");

  // Patch 9: per-member webcam verification
  const [verifyTarget, setVerifyTarget] = useState<{ regId: string; memberIdx: number; storedFace: string | null; email?: string } | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function buildLeaderboard(assignments: JudgeAssignment[], weight: number) {
    const teamScores: Record<string, any> = {};
    assignments.forEach((a) => {
      if (!teamScores[a.teamName]) {
        teamScores[a.teamName] = { team: a.teamName, aiScore: a.aiScore, judgeScore: a.judgeScore };
      } else {
        if (a.aiScore != null) teamScores[a.teamName].aiScore = a.aiScore;
        if (a.judgeScore != null) {
          const ex = teamScores[a.teamName].judgeScore;
          teamScores[a.teamName].judgeScore = ex != null ? Math.round((ex + a.judgeScore) / 2) : a.judgeScore;
        }
      }
    });
    const entries = Object.values(teamScores)
      .map((t: any) => {
        const ai = t.aiScore || 0;
        const judge = t.judgeScore || 0;
        return { ...t, final: Math.round((weight / 100) * ai + ((100 - weight) / 100) * judge) };
      })
      .sort((a: any, b: any) => b.final - a.final)
      .map((e: any, i: number) => ({ rank: i + 1, ...e }));
    setLeaderboard(entries);
  }

  useEffect(() => {
    if (!id) return;

    const reloadData = () => {
      const h = getHackathon(id);
      if (!h) return;
      setHackathon(h);
      setName(h.name);
      setDescription(h.description || h.desc || "");
      setStartDate(h.startDate);
      setEndDate(h.endDate);
      setRounds(h.rounds || []);
      setMinTeam(h.minTeamSize || "2");
      setMaxTeam(h.maxTeamSize || "5");
      setCriteria(h.criteria || []);
      setAiWeight(h.aiWeight ?? 50);

      setParticipants(getRegistrations(id));
      setAnnouncements(getNotifications(id));
      const assignments = getJudgeAssignments(undefined, id);
      setJudgeAssignments(assignments);
      setJudges(getJudges(id));
      buildLeaderboard(assignments, h.aiWeight ?? 50);
    };

    reloadData();

    // Listen for database sync storage events to update UI in real-time
    window.addEventListener("storage", reloadData);
    return () => window.removeEventListener("storage", reloadData);
  }, [id]);

  const saveOverview = () => {
    if (!id) return;
    updateHackathon(id, { name, description, desc: description, startDate, endDate });
    toast({ title: "Saved" });
  };

  const addRound = () => {
    const newRound: Round = { id: crypto.randomUUID().slice(0, 8), name: `Round ${rounds.length + 1}`, description: "", deadline: "", submissionType: "PPT", shortlist: false };
    const updated = [...rounds, newRound];
    setRounds(updated);
    if (id) updateHackathon(id, { rounds: updated });
  };

  const removeRound = (roundId: string) => {
    const updated = rounds.filter((r) => r.id !== roundId);
    setRounds(updated);
    if (id) updateHackathon(id, { rounds: updated });
    toast({ title: "Round removed" });
  };

  const updateRound = (roundId: string, field: keyof Round, value: any) => {
    const updated = rounds.map((r) => r.id === roundId ? { ...r, [field]: value } : r);
    setRounds(updated);
    if (id) updateHackathon(id, { rounds: updated });
  };

  const handleShortlist = (regId: string, status: "Shortlisted" | "Rejected" | "Verified") => {
    updateRegistration(regId, { status });
    setParticipants((prev) => prev.map((p) => p.id === regId ? { ...p, status } : p));
    toast({ title: `Participant ${status}` });
  };

  const saveTeamRules = () => {
    if (!id) return;
    updateHackathon(id, { minTeamSize: minTeam, maxTeamSize: maxTeam });
    toast({ title: "Saved" });
  };

  const addCriteria = () => setCriteria([...criteria, { id: crypto.randomUUID().slice(0, 8), name: "", weight: 0 }]);
  const removeCriteria = (cid: string) => setCriteria(criteria.filter((c) => c.id !== cid));

  const saveEvaluation = () => {
    const total = criteria.reduce((s, c) => s + (c.weight || 0), 0);
    if (criteria.length > 0 && total !== 100) {
      toast({ title: "Weight Error", description: `Total must be 100%. Currently: ${total}%`, variant: "destructive" });
      return;
    }
    if (id) updateHackathon(id, { criteria, aiWeight });
    toast({ title: "Evaluation criteria saved" });
  };

  const postAnnouncement = () => {
    if (!announcementTitle || !announcementMsg) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    const notification: Notification = {
      id: crypto.randomUUID().slice(0, 8),
      hackathonId: id || "",
      title: announcementTitle,
      message: announcementMsg,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    addNotification(notification);
    setAnnouncements([notification, ...announcements]);
    setAnnouncementTitle(""); setAnnouncementMsg("");
    toast({ title: "Announcement posted" });
  };

  /* ── Fix 3: Add judge → register in Django + localStorage ── */
  const handleAddJudge = async () => {
    if (!judgeEmail.trim() || !judgeName.trim()) {
      toast({ title: "Fill judge details", variant: "destructive" }); return;
    }
    const newJudge: Judge = {
      id: crypto.randomUUID().slice(0, 8),
      name: judgeName.trim(),
      email: judgeEmail.trim(),
      hackathonId: id || "",
    };
    addJudge(id || "", newJudge);
    setJudges((prev) => [...prev, newJudge]); // immediate UI update

    // Fix 3: Auto-register judge in Django so they can log in
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "https://hackmanager-2.onrender.com";
      const res = await fetch(`${BASE_URL}/api/auth/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: judgeName.trim().replace(/\s+/g, "_").toLowerCase(),
          email: judgeEmail.trim(),
          password: "judge123",  // Default password — judge should change it
          role: "judge",
        }),
      });
      if (res.ok) {
        toast({ title: "Judge added", description: `${newJudge.name} registered. Default password: judge123` });
      } else {
        const err = await res.json().catch(() => ({}));
        // If email already exists, that's OK — judge can still log in
        if (err?.email?.[0]?.includes("already")) {
          toast({ title: "Judge added", description: `${newJudge.name} (account already exists)` });
        } else {
          toast({ title: "Judge added locally", description: "Could not auto-register in backend. Create account manually.", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Judge added locally", description: "Backend unreachable. Judge may need manual account creation.", variant: "destructive" });
    }
    setJudgeEmail(""); setJudgeName("");
  };

  const handleRemoveJudge = (judgeId: string) => {
    removeJudge(id || "", judgeId);
    setJudges((prev) => prev.filter((j) => j.id !== judgeId));
    toast({ title: "Judge removed" });
  };

  const handleAssignTeam = (judge: Judge, reg: Registration) => {
    const ppts = getAllPPTSubmissions(id);
    const githubs = getGitHubSubmissions(id);
    const ppt = ppts.find((p) => p.userEmail === reg.userEmail);
    const github = githubs.find((g) => g.userEmail === reg.userEmail);
    const alreadyAssigned = judgeAssignments.some((a) => a.teamId === reg.id && a.judgeEmail === judge.email);
    if (alreadyAssigned) return;

    const assignment: JudgeAssignment = {
      hackathonId: id || "", judgeEmail: judge.email, judgeName: judge.name,
      teamName: reg.teamName, teamId: reg.id,
      pptLink: ppt?.link || null, pptName: ppt?.name || null,
      githubUrl: github?.url || null,
      repoContent: null, pptContent: null,
      aiScore: null, aiSummary: null, aiStrengths: null, aiWeaknesses: null,
      judgeScore: null, status: "Pending",
    };
    addJudgeAssignment(assignment);
    setJudgeAssignments((prev) => [...prev, assignment]);
    toast({ title: "Team assigned", description: `${reg.teamName} → ${judge.name}` });
  };

  /* ── Patch 9: Face Verification ── */
  const openVerification = async (reg: Registration, memberIdx: number) => {
    setCameraError(""); setCapturedImage(null); setSimilarity(null);
    const member = reg.members[memberIdx];
    setVerifyTarget({
      regId: reg.id,
      memberIdx,
      storedFace: member?.faceEncoding || reg.faceImage,
      email: member?.email || reg.userEmail
    });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setCameraError("Camera access denied");
    }
  };

  const closeVerification = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setVerifyTarget(null);
    setCapturedImage(null);
    setSimilarity(null);
    setCameraError("");
  };

  const captureAndCompare = async () => {
    if (!videoRef.current || !verifyTarget) return;
    setVerifying(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 300;
    canvas.height = videoRef.current.videoHeight || 300;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const captured = canvas.toDataURL("image/jpeg", 0.7);
    setCapturedImage(captured);

    try {
      // Convert captured base64 image to Blob
      const blob = await (await fetch(captured)).blob();
      const file = new File([blob], "verify.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);

      // Call backend face verify endpoint with target email parameter (1-to-1 matching)
      const targetEmail = verifyTarget.email || "";
      const emailParam = targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : "";
      const token = localStorage.getItem("auth_token");

      const res = await fetch(`http://localhost:8000/api/face/verify${emailParam}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verification request failed.");
      }

      if (data.success && data.verified) {
        const simPct = Math.round(data.similarity * 100);
        setSimilarity(simPct);
        
        // Mark member as verified in localStorage database
        updateMemberVerification(verifyTarget.regId, verifyTarget.memberIdx, true, captured);
        setParticipants(getRegistrations(id));
        toast({ title: `Verified! Similarity: ${simPct}%`, description: "Member identity successfully verified." });
        closeVerification();
      } else {
        const simPct = Math.round((data.similarity || 0) * 100);
        setSimilarity(simPct);
        toast({
          title: "Verification Failed",
          description: data.message || `Face mismatch (Similarity: ${simPct}%).`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      // Fallback to grayscale client-side comparison if server fails/unreachable
      toast({
        title: "Server Verification Offline",
        description: "Using local fallback pixel comparison.",
        variant: "destructive",
      });

      if (!verifyTarget.storedFace) {
        updateMemberVerification(verifyTarget.regId, verifyTarget.memberIdx, true, captured);
        setParticipants(getRegistrations(id));
        toast({ title: "Face captured and marked verified (no reference image)" });
        closeVerification();
      } else {
        const sim = await compareImages(verifyTarget.storedFace, captured);
        setSimilarity(sim);
        if (sim >= 70) {
          updateMemberVerification(verifyTarget.regId, verifyTarget.memberIdx, true, captured);
          setParticipants(getRegistrations(id));
          toast({ title: `Verified! Similarity: ${sim}%`, description: "Member marked as verified." });
          closeVerification();
        } else {
          toast({
            title: `Verification Failed (Local): ${sim}%`,
            description: "Below 70% threshold. Try again with better lighting.",
            variant: "destructive",
          });
        }
      }
    } finally {
      setVerifying(false);
    }
  };

  const exportCSV = () => {
    if (leaderboard.length === 0) { toast({ title: "No data", variant: "destructive" }); return; }
    const headers = ["Rank", "Team", "AI Score", "Judge Score", "Final Score"];
    const rows = leaderboard.map((r) => [r.rank, r.team, r.aiScore ?? "N/A", r.judgeScore ?? "N/A", r.final]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}_leaderboard.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  if (!hackathon) {
    return (
      <div className="flex min-h-screen pt-16">
        <DashboardSidebar items={sidebarItems} title="Admin" />
        <main className="flex-1 p-6">
          <p className="text-muted-foreground">Hackathon not found. <Link to="/admin" className="text-primary hover:underline">← Back</Link></p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Admin" />
      <main className="flex-1 p-6 md:p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Link to="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="mb-1 font-display text-2xl font-bold">{name}</h1>
          <p className="mb-6 text-sm text-muted-foreground">ID: {id}</p>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="team-rules">Team Rules</TabsTrigger>
              <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="grievances">Grievances</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview">
              <div className="glass-card space-y-5 p-6">
                <h2 className="font-display text-lg font-semibold">Basic Information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Name</Label><Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div><Label>Status</Label><Input className="mt-1.5" value={hackathon.status} disabled /></div>
                  <div><Label>Start Date</Label><Input className="mt-1.5" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div><Label>End Date</Label><Input className="mt-1.5" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <div><Label>Description</Label><Textarea className="mt-1.5" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <Button className="btn-primary-glow" onClick={saveOverview}>Save Changes</Button>
              </div>
            </TabsContent>

            {/* ── TIMELINE ── */}
            <TabsContent value="timeline">
              <div className="glass-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Rounds</h2>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={addRound}>
                    <PlusCircle className="h-4 w-4" /> Add Round
                  </Button>
                </div>
                <div className="space-y-4">
                  {rounds.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <Input value={r.name} onChange={(e) => updateRound(r.id, "name", e.target.value)} className="font-semibold max-w-xs" />
                        <Button variant="ghost" size="icon" onClick={() => removeRound(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                        <div><Label className="text-xs">Description</Label><Input className="mt-1" value={r.description} onChange={(e) => updateRound(r.id, "description", e.target.value)} /></div>
                        <div><Label className="text-xs">Deadline</Label><Input className="mt-1" type="date" value={r.deadline} onChange={(e) => updateRound(r.id, "deadline", e.target.value)} /></div>
                        <div>
                          <Label className="text-xs">Submission Type</Label>
                          <Select value={r.submissionType} onValueChange={(v) => updateRound(r.id, "submissionType", v)}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PPT">PPT</SelectItem>
                              <SelectItem value="GitHub">GitHub</SelectItem>
                              <SelectItem value="Form">Form</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2 pb-1">
                          <Label className="text-xs">Shortlist</Label>
                          <Switch checked={r.shortlist} onCheckedChange={(v) => updateRound(r.id, "shortlist", v)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {rounds.length === 0 && <p className="text-sm text-muted-foreground italic py-4 text-center">No rounds yet.</p>}
                </div>
              </div>
            </TabsContent>

            {/* ── TEAM RULES ── */}
            <TabsContent value="team-rules">
              <div className="glass-card space-y-5 p-6">
                <h2 className="font-display text-lg font-semibold">Team Rules</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Min Team Size</Label><Input className="mt-1.5" type="number" min={1} value={minTeam} onChange={(e) => setMinTeam(e.target.value)} /></div>
                  <div><Label>Max Team Size</Label><Input className="mt-1.5" type="number" min={1} value={maxTeam} onChange={(e) => setMaxTeam(e.target.value)} /></div>
                </div>
                <Button className="btn-primary-glow" onClick={saveTeamRules}>Save</Button>
              </div>
            </TabsContent>

            {/* ── EVALUATION ── */}
            <TabsContent value="evaluation">
              <div className="glass-card p-6">
                <h2 className="mb-4 font-display text-lg font-semibold">Evaluation Matrix</h2>
                {criteria.length > 0 && (() => {
                  const total = criteria.reduce((s, c) => s + (c.weight || 0), 0);
                  return (
                    <p className={`mb-3 text-xs font-semibold ${total === 100 ? "text-success" : "text-destructive"}`}>
                      Weight total: {total}% {total !== 100 && "(must equal 100%)"}
                    </p>
                  );
                })()}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criteria</TableHead>
                      <TableHead className="w-32">Weight (%)</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteria.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell><Input value={c.name} onChange={(e) => setCriteria(criteria.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))} /></TableCell>
                        <TableCell><Input type="number" value={c.weight} min={0} max={100} onChange={(e) => setCriteria(criteria.map((x) => x.id === c.id ? { ...x, weight: parseInt(e.target.value) || 0 } : x))} /></TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeCriteria(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={addCriteria}><PlusCircle className="h-4 w-4" /> Add Criteria</Button>
                <div className="mt-6 rounded-xl border border-border/50 p-4">
                  <h3 className="mb-3 font-display text-sm font-semibold">Score Weights</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1"><Label className="text-xs">AI Weight: {aiWeight}%</Label><input type="range" min={0} max={100} value={aiWeight} onChange={(e) => setAiWeight(Number(e.target.value))} className="mt-1 w-full accent-primary" /></div>
                    <div className="flex-1"><Label className="text-xs">Judge Weight: {100 - aiWeight}%</Label><input type="range" min={0} max={100} value={100 - aiWeight} readOnly className="mt-1 w-full accent-accent" /></div>
                  </div>
                </div>
                <Button
                  className="btn-primary-glow mt-4"
                  onClick={saveEvaluation}
                  disabled={criteria.length > 0 && criteria.reduce((s, c) => s + (c.weight || 0), 0) !== 100}
                >
                  Save Evaluation
                </Button>
              </div>
            </TabsContent>

            {/* ── ANNOUNCEMENTS ── */}
            <TabsContent value="announcements">
              <div className="glass-card p-6">
                <h2 className="mb-4 font-display text-lg font-semibold">Announcements</h2>
                <div className="mb-6 space-y-3 rounded-xl border border-border/50 p-4">
                  <Input placeholder="Title" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
                  <Textarea placeholder="Message..." rows={2} value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} />
                  <Button size="sm" className="btn-primary-glow" onClick={postAnnouncement}>Post</Button>
                </div>
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a.id} className="rounded-lg border border-border/30 p-4">
                      <div className="flex justify-between"><h3 className="text-sm font-semibold">{a.title}</h3><span className="text-xs text-muted-foreground">{a.date}</span></div>
                      <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                    </div>
                  ))}
                  {announcements.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">No announcements yet.</p>}
                </div>
              </div>
            </TabsContent>

            {/* ── PARTICIPANTS – Patch 4: per-member rows + Patch 9: face verify ── */}
            <TabsContent value="participants">
              <div className="glass-card p-6">
                <h2 className="mb-4 font-display text-lg font-semibold">Registered Teams ({participants.length})</h2>
                {participants.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground text-center py-8">No registrations yet.</p>
                ) : (
                  <div className="space-y-4">
                    {participants.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border/50 p-4">
                        {/* Team header */}
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{p.teamName}</p>
                            <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={p.status === "Verified" || p.status === "Shortlisted" ? "default" : "secondary"}>
                              {p.status}
                            </Badge>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                title={isTeamEligible(p.id) ? "Shortlist" : "All members must be verified first"}
                                onClick={() => handleShortlist(p.id, "Shortlisted")}
                                disabled={!isTeamEligible(p.id)}
                              >
                                <Check className={`h-3.5 w-3.5 ${isTeamEligible(p.id) ? "text-success" : "text-muted-foreground"}`} />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Reject" onClick={() => handleShortlist(p.id, "Rejected")}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Per-member rows — Patch 4 */}
                        {p.members && p.members.length > 0 ? (
                          <div className="divide-y divide-border/20">
                            {p.members.map((member: TeamMember, idx: number) => (
                              <div key={idx} className="flex items-center justify-between py-2">
                                <div>
                                  <p className="text-sm font-medium">{member.name}</p>
                                  <p className="text-xs text-muted-foreground">{[member.phone, member.college].filter(Boolean).join(" · ")}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {member.verificationStatus ? (
                                    <span className="flex items-center gap-1 text-xs text-success"><UserCheck className="h-3.5 w-3.5" /> Verified</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Unverified</span>
                                  )}
                                  {/* Patch 9: face verify button */}
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() => openVerification(p, idx)}
                                  >
                                    <Camera className="h-3 w-3" />
                                    {member.verificationStatus ? "Retry" : "Verify"}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Legacy: single member button
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openVerification(p, 0)}>
                            <Camera className="h-3 w-3" /> Verify Face
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── JUDGES — Patch 7: live list ── */}
            <TabsContent value="judges">
              <div className="glass-card p-6">
                <h2 className="mb-4 font-display text-lg font-semibold">Judges</h2>
                <div className="mb-6 rounded-xl border border-border/50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Add Judge</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Judge Name" value={judgeName} onChange={(e) => setJudgeName(e.target.value)} />
                    <Input placeholder="Judge Email" type="email" value={judgeEmail} onChange={(e) => setJudgeEmail(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleAddJudge}>Add Judge</Button>
                </div>

                {/* Live judge list */}
                {judges.length > 0 && (
                  <div className="mb-6 space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Added Judges ({judges.length})</h3>
                    {judges.map((j) => (
                      <div key={j.id} className="flex items-center justify-between rounded-lg border border-border/30 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{j.name}</p>
                          <p className="text-xs text-muted-foreground">{j.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {participants.length > 0 && (
                            <select
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const matched = participants.find((p) => p.id === val);
                                if (matched) {
                                  handleAssignTeam(j, matched);
                                }
                                e.target.value = "";
                              }}
                              className="rounded-lg border border-border bg-secondary/50 px-2 py-1 text-xs focus:border-primary focus:outline-none max-w-[180px]"
                            >
                              <option value="">Assign Team...</option>
                              {participants.map((p) => {
                                const assigned = judgeAssignments.some((a) => a.teamId === p.id && a.judgeEmail === j.email);
                                return (
                                  <option key={p.id} value={p.id} disabled={assigned}>
                                    {p.teamName} {assigned ? "(Assigned)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveJudge(j.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {judges.length === 0 && <p className="text-sm text-muted-foreground italic">No judges added yet.</p>}

                {/* Assignment summary */}
                {judgeAssignments.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Assignments ({judgeAssignments.length})</h3>
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Judge</TableHead><TableHead>Team</TableHead><TableHead>Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {judgeAssignments.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{a.judgeName}</TableCell>
                            <TableCell>{a.teamName}</TableCell>
                            <TableCell><Badge variant={a.status === "Evaluated" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── LEADERBOARD ── */}
            <TabsContent value="leaderboard">
              <div className="glass-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Live Leaderboard</h2>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                </div>
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-8">No scores yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>AI Score</TableHead>
                        <TableHead>Judge Score</TableHead>
                        <TableHead>Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((r) => (
                        <TableRow key={r.rank}>
                          <TableCell className="font-display font-bold text-primary">#{r.rank}</TableCell>
                          <TableCell className="font-medium">{r.team}</TableCell>
                          <TableCell>{r.aiScore ?? "N/A"}</TableCell>
                          <TableCell>{r.judgeScore ?? "N/A"}</TableCell>
                          <TableCell className="font-semibold">{r.final}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* ── GRIEVANCES ── Feature 2: Admin grievance management */}
            <TabsContent value="grievances">
              <div className="glass-card p-6">
                <h2 className="mb-4 font-display text-lg font-semibold">Grievances</h2>
                {(() => {
                  const hackathonTickets = id ? getTickets(undefined, id) : [];
                  if (hackathonTickets.length === 0) {
                    return <p className="text-sm italic text-muted-foreground text-center py-8">No grievances submitted.</p>;
                  }
                  return (
                    <div className="space-y-4">
                      {hackathonTickets.map((t) => (
                        <div key={t.id} className="rounded-xl border border-border/50 p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-sm font-semibold">{t.subject}</h3>
                              <p className="text-xs text-muted-foreground">{t.studentName} ({t.studentEmail}) · {t.category} · {new Date(t.createdAt).toLocaleDateString()}</p>
                            </div>
                            <select
                              value={t.status}
                              onChange={(e) => {
                                updateTicket(t.id, { status: e.target.value as any });
                                toast({ title: `Status → ${e.target.value}` });
                              }}
                              className="rounded-lg border border-border bg-secondary/50 px-2 py-1 text-xs"
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          </div>
                          <p className="text-sm text-muted-foreground">{t.messages[0]?.text}</p>

                          {/* Display messages thread */}
                          <div className="space-y-2 mt-2">
                            {t.messages.slice(1).map((m, idx) => (
                              <div key={idx} className={`rounded-lg p-2 text-xs ${m.from === "admin" ? "bg-primary/5 border border-primary/10 ml-4" : "bg-secondary border border-border mr-4"}`}>
                                <span className="font-semibold uppercase">{m.from}:</span> {m.text}
                                <span className="ml-2 opacity-50">{m.time}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Input
                              placeholder="Type admin response..."
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (!val) return;
                                  addTicketMessage(t.id, {
                                    from: "admin",
                                    text: val,
                                    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                                  });
                                  (e.target as HTMLInputElement).value = "";
                                  toast({ title: "Reply sent" });
                                }
                              }}
                              className="bg-secondary/30 text-xs"
                            />
                            <button
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const val = input.value.trim();
                                if (!val) return;
                                addTicketMessage(t.id, {
                                  from: "admin",
                                  text: val,
                                  time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                                });
                                input.value = "";
                                toast({ title: "Reply sent" });
                              }}
                              className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* ── Patch 9: Face Verification Modal ── */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-sm p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Face Verification</h2>
            {cameraError ? (
              <p className="text-sm text-destructive">{cameraError}</p>
            ) : (
              <div className="space-y-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
                {similarity !== null && (
                  <div className={`rounded-lg p-3 text-center text-sm font-semibold ${similarity >= 70 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    Similarity: {similarity}% {similarity >= 70 ? "✓ Match" : "✗ No match"}
                  </div>
                )}
                {capturedImage && <img src={capturedImage} className="w-full rounded-xl" alt="Captured" />}
                <div className="flex gap-2">
                  <Button className="flex-1 gap-1.5" onClick={captureAndCompare} disabled={verifying}>
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {similarity !== null ? "Retry" : "Capture & Verify"}
                  </Button>
                  <Button variant="outline" onClick={closeVerification}>Cancel</Button>
                </div>
                {!verifyTarget.storedFace && (
                  <p className="text-xs text-muted-foreground text-center">No reference face stored — will capture as verification reference</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
