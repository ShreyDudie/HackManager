// =============================================================================
// JudgeDashboard.tsx — Patches 5, 7, 8: real repo fetch + AI cache + judge list
// Fetches actual README.md before calling Groq. Caches in sq_ai_cache.
// Never guesses from titles. Shows content source clearly.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, FileText, MessageSquare, Send,
  Loader2, ExternalLink, Bot, Sparkles, CheckCircle, AlertTriangle, Eye
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getJudgeAssignments,
  updateJudgeAssignment,
  getProjectSnapshot,
  saveProjectSnapshot,
  getAiCache,
  setAiCache,
  getAllPPTSubmissions,
  getRegistrations,
  type JudgeAssignment,
  type ProjectSnapshot,
  type AiEvaluation,
} from "@/lib/storage";
import {
  evaluatePPT,
  chatWithRepo,
  generateProjectSnapshot,
  fetchRepoContent,
  extractPDFContent,
  isAIAvailable,
  type ContentFetchResult,
} from "@/lib/ai";

const sidebarItems = [
  { to: "/judge", label: "Overview", icon: LayoutDashboard },
];

/* ── Content source badge ── */
const SourceBadge = ({ source }: { source: string }) => {
  if (source === "readme") return (
    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
      <CheckCircle className="h-3 w-3" /> README fetched
    </span>
  );
  if (source === "not_found") return (
    <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
      <AlertTriangle className="h-3 w-3" /> README not found
    </span>
  );
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <AlertTriangle className="h-3 w-3" /> Content blocked
    </span>
  );
};

/* ── Markdown Formatter Helper ── */
function parseInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return <strong key={index} className="font-semibold text-primary">{boldText}</strong>;
    }
    return part;
  });
}

function renderFormattedMessage(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const bulletMatch = line.match(/^(\s*)[*\-]\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[2];
      return (
        <ul key={idx} className="list-disc pl-4 space-y-0.5 text-xs text-muted-foreground my-0.5">
          <li>{parseInlineFormatting(content)}</li>
        </ul>
      );
    }

    const numMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (numMatch) {
      const content = numMatch[2];
      return (
        <ol key={idx} className="list-decimal pl-4 space-y-0.5 text-xs text-muted-foreground my-0.5">
          <li>{parseInlineFormatting(content)}</li>
        </ol>
      );
    }

    if (line.trim() === "") {
      return <div key={idx} className="h-1.5" />;
    }
    return (
      <p key={idx} className="leading-relaxed font-sans text-xs my-0.5 text-foreground">
        {parseInlineFormatting(line)}
      </p>
    );
  });
}

export default function JudgeDashboard() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<Record<string, ContentFetchResult>>({});

  // Chat
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<JudgeAssignment | null>(null);
  const [chatRepoContent, setChatRepoContent] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Snapshots cache
  const [snapshots, setSnapshots] = useState<Record<string, ProjectSnapshot>>({});
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;

    const reloadData = () => {
      const loaded = getJudgeAssignments(user.email!);
      setAssignments(loaded);

      const cached: Record<string, ProjectSnapshot> = {};
      loaded.forEach((a) => {
        const snap = getProjectSnapshot(a.teamId, a.hackathonId);
        if (snap) cached[a.teamId] = snap;
      });
      setSnapshots(cached);
    };

    reloadData();

    // Listen for database sync storage events to update UI in real-time
    window.addEventListener("storage", reloadData);
    return () => window.removeEventListener("storage", reloadData);
  }, [user]);

  const handleSubmitScore = (teamId: string) => {
    const score = parseInt(scoreInput);
    if (isNaN(score) || score < 0 || score > 100) {
      toast({ title: "Invalid Score", description: "Enter a score between 0-100", variant: "destructive" });
      return;
    }
    updateJudgeAssignment(user?.email || "", teamId, { judgeScore: score, status: "Evaluated" });
    setAssignments((prev) => prev.map((a) => a.teamId === teamId ? { ...a, judgeScore: score, status: "Evaluated" } : a));
    setScoreInput("");
    setSelectedTeam(null);
    toast({ title: "Score Submitted!" });
  };

  const handleAIEvaluate = async (assignment: JudgeAssignment) => {
    if (!isAIAvailable()) {
      toast({ title: "AI Not Available", description: "Set VITE_GROQ_API_KEY in .env.local", variant: "destructive" });
      return;
    }
    if (!assignment.pptName) {
      toast({ title: "No PPT", description: "Team hasn't submitted a PPT yet.", variant: "destructive" });
      return;
    }

    const submissionId = `${assignment.hackathonId}_${assignment.teamId}`;

    // Check cache first
    const cached = getAiCache(submissionId);
    if (cached) {
      updateJudgeAssignment(user?.email || "", assignment.teamId, {
        aiScore: cached.score,
        aiSummary: cached.summary,
        aiStrengths: cached.strengths,
        aiWeaknesses: cached.weaknesses,
      });
      setAssignments((prev) => prev.map((a) =>
        a.teamId === assignment.teamId
          ? { ...a, aiScore: cached.score, aiSummary: cached.summary, aiStrengths: cached.strengths, aiWeaknesses: cached.weaknesses }
          : a
      ));
      toast({ title: "Loaded from cache", description: `Score: ${cached.score}/100` });
      return;
    }

    setAiLoading(assignment.teamId);
    let repoContent: string | null = null;
    let source: ContentFetchResult["source"] = "blocked";

    // Step 1: Fetch actual README
    if (assignment.githubUrl) {
      toast({ title: "Fetching repository...", description: assignment.githubUrl });
      const fetchResult = await fetchRepoContent(assignment.githubUrl);
      repoContent = fetchResult.content;
      source = fetchResult.source;
      setFetchStatus((prev) => ({ ...prev, [assignment.teamId]: fetchResult }));

      if (fetchResult.source === "blocked") {
        toast({
          title: "Repository not accessible",
          description: fetchResult.error || "Could not fetch README.md. AI will evaluate with limited context.",
          variant: "destructive",
        });
      }
    }

    try {
      // Feature 5: Extract PDF text if available (Async with URL support)
      let pdfText: string | null = null;
      const ppts = getAllPPTSubmissions(assignment.hackathonId);
      const reg = getRegistrations().find(r => r.id === assignment.teamId);
      const emails = reg 
        ? [reg.userEmail, ...(reg.members || []).map(m => m.email)].filter(Boolean)
        : [assignment.teamId];
      const matchedPpt = ppts.find((p) => emails.includes(p.userEmail));

      if (matchedPpt) {
        if (matchedPpt.pdfUrl || matchedPpt.pdfBase64) {
          toast({ title: "Extracting PDF text..." });
          pdfText = await extractPDFContent({
            url: matchedPpt.pdfUrl,
            base64: matchedPpt.pdfBase64
          });
        }
      }

      const result = await evaluatePPT(
        assignment.pptName,
        assignment.pptLink || "",
        assignment.teamName,
        repoContent,
        pdfText
      );

      // Cache result
      const evaluation: AiEvaluation = {
        submissionId,
        score: result.score,
        summary: result.summary,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        cachedAt: new Date().toISOString(),
        repoFetched: source === "readme",
        contentSource: source === "readme" ? "readme" : "blocked",
      };
      setAiCache(evaluation);

      updateJudgeAssignment(user?.email || "", assignment.teamId, {
        aiScore: result.score,
        aiSummary: result.summary,
        aiStrengths: result.strengths,
        aiWeaknesses: result.weaknesses,
        repoContent,
      });

      setAssignments((prev) => prev.map((a) =>
        a.teamId === assignment.teamId
          ? { ...a, aiScore: result.score, aiSummary: result.summary, aiStrengths: result.strengths, aiWeaknesses: result.weaknesses, repoContent }
          : a
      ));
      toast({ title: "AI Evaluation Complete", description: `Score: ${result.score}/100` });
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  };

  const handleGenerateSnapshot = async (assignment: JudgeAssignment) => {
    if (!isAIAvailable()) {
      toast({ title: "AI Not Available", variant: "destructive" });
      return;
    }
    setSnapshotLoading(assignment.teamId);

    // Fetch repo content if available
    let repoContent: string | null = null;
    if (assignment.githubUrl) {
      const res = await fetchRepoContent(assignment.githubUrl);
      repoContent = res.content;
    }

    try {
      const result = await generateProjectSnapshot(
        assignment.githubUrl || "",
        assignment.pptName || "",
        assignment.teamName,
        repoContent
      );
      const snapshot: ProjectSnapshot = {
        teamId: assignment.teamId,
        hackathonId: assignment.hackathonId,
        summary: result.summary,
        techStack: result.techStack,
        keyFeatures: result.keyFeatures,
        cachedAt: new Date().toISOString(),
      };
      saveProjectSnapshot(snapshot);
      setSnapshots((prev) => ({ ...prev, [assignment.teamId]: snapshot }));
      toast({ title: "Snapshot Generated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSnapshotLoading(null);
    }
  };

  // Select a repo for chat — also pre-fetch README
  const handleSelectForChat = async (a: JudgeAssignment) => {
    setSelectedAssignment(a);
    setChatMessages([]);
    setChatRepoContent(null);
    if (a.githubUrl) {
      const res = await fetchRepoContent(a.githubUrl);
      setChatRepoContent(res.content);
      if (res.source === "readme") {
        toast({ title: "README loaded", description: "AI will answer based on actual code" });
      } else {
        toast({ title: "README not accessible", description: "AI will have limited context", variant: "destructive" });
      }
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !selectedAssignment) return;

    const newMsg = { role: "user" as const, content: chatInput.trim() };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await chatWithRepo(
        selectedAssignment.githubUrl || "",
        newMsg.content,
        chatMessages.map((m) => ({ role: m.role, content: m.content })),
        chatRepoContent
      );
      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const evaluated = assignments.filter((a) => a.status === "Evaluated").length;
  const pending = assignments.filter((a) => a.status === "Pending").length;

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Judge" />
      <main className="flex-1 p-6 md:p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="mb-1 font-display text-2xl font-bold">Judge Panel</h1>
          <p className="mb-6 text-sm text-muted-foreground">Review and score assigned submissions</p>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assignments">Snapshots</TabsTrigger>
              <TabsTrigger value="questions">Questions</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview">
              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <div className="glass-card p-5">
                  <p className="text-xs text-muted-foreground">Total Assigned</p>
                  <p className="mt-2 font-display text-2xl font-bold">{assignments.length}</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-xs text-muted-foreground">Evaluated</p>
                  <p className="mt-2 font-display text-2xl font-bold text-success">{evaluated}</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="mt-2 font-display text-2xl font-bold text-warning">{pending}</p>
                </div>
              </div>

              {assignments.length === 0 ? (
                <div className="glass-card p-12 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm">No assignments yet.</p>
                </div>
              ) : (
                <div className="glass-card overflow-hidden">
                  <div className="border-b border-border/50 px-6 py-4">
                    <h2 className="font-display text-lg font-semibold">Assigned PPTs</h2>
                  </div>
                  <div className="divide-y divide-border/30">
                    {assignments.map((a) => {
                      const cached = getAiCache(`${a.hackathonId}_${a.teamId}`);
                      const fs = fetchStatus[a.teamId];
                      return (
                        <div key={a.teamId} className="px-6 py-4 space-y-3">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="min-w-[140px] space-y-1">
                              <p className="text-sm font-medium">{a.teamName}</p>
                              {/* Submission Link / PDF */}
                              <div className="flex flex-wrap gap-2">
                                {a.pptLink && (
                                  <a href={a.pptLink} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                                    <ExternalLink className="h-3 w-3" /> External Link
                                  </a>
                                )}
                                {(() => {
                                  const ppts = getAllPPTSubmissions(a.hackathonId);
                                  const reg = getRegistrations().find(r => r.id === a.teamId);
                                  const emails = reg 
                                    ? [reg.userEmail, ...(reg.members || []).map(m => m.email)].filter(Boolean)
                                    : [a.teamId];
                                  const matched = ppts.find(p => emails.includes(p.userEmail));
                                  if (matched) {
                                    return (
                                      <button onClick={() => {
                                        if (matched.pdfUrl) window.open(matched.pdfUrl, "_blank");
                                        else if (matched.pdfBase64) {
                                          const win = window.open();
                                          win?.document.write(`<html><body style="margin:0"><iframe src="${matched.pdfBase64}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
                                        }
                                      }} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary">
                                        <FileText className="h-3 w-3" /> View PDF
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>      {fs && <SourceBadge source={fs.source} />}
                              {cached && <span className="text-[10px] text-muted-foreground">⚡ Cached</span>}
                            </div>

                            <div className="flex items-center gap-6 text-sm">
                              <div>
                                <span className="text-xs text-muted-foreground">AI: </span>
                                <span className="font-semibold text-primary">{a.aiScore ?? "—"}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Judge: </span>
                                <span className="font-semibold">{a.judgeScore ?? "—"}</span>
                              </div>
                              {a.aiScore != null && a.judgeScore != null && (
                                <div>
                                  <span className="text-xs text-muted-foreground">Final: </span>
                                  <span className="font-semibold text-accent">
                                    {(0.5 * a.aiScore + 0.5 * a.judgeScore).toFixed(0)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="ml-auto flex gap-2 items-center">
                              {a.aiScore == null && (
                                <button
                                  onClick={() => handleAIEvaluate(a)}
                                  disabled={aiLoading === a.teamId}
                                  className="flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                                >
                                  {aiLoading === a.teamId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                  AI Score
                                </button>
                              )}

                              {a.status === "Pending" ? (
                                selectedTeam === a.teamId ? (
                                  <div className="flex items-center gap-2">
                                    <input type="number" min={0} max={100} value={scoreInput} onChange={(e) => setScoreInput(e.target.value)}
                                      placeholder="0-100"
                                      className="w-20 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
                                    <button onClick={() => handleSubmitScore(a.teamId)} className="rounded-lg bg-primary p-2 text-primary-foreground">
                                      <Send className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setSelectedTeam(a.teamId)}
                                    className="rounded-lg border border-primary/30 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
                                    Score
                                  </button>
                                )
                              ) : (
                                <span className="text-xs font-medium text-success">✓ Done</span>
                              )}
                            </div>
                          </div>

                          {a.aiSummary && (
                            <div className="rounded-lg bg-secondary/30 p-3 text-xs space-y-1">
                              <p><strong>Summary:</strong> {a.aiSummary}</p>
                              <p><strong>Strengths:</strong> {a.aiStrengths}</p>
                              <p><strong>Weaknesses:</strong> {a.aiWeaknesses}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── SNAPSHOTS ── */}
            <TabsContent value="assignments">
              <h2 className="mb-4 font-display text-lg font-semibold">Project Snapshots</h2>
              {assignments.length === 0 ? (
                <div className="glass-card p-12 text-center text-muted-foreground text-sm">No assignments yet.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {assignments.map((a) => {
                    const snap = snapshots[a.teamId];
                    return (
                      <div key={a.teamId} className="glass-card p-5 space-y-3">
                        <h3 className="font-display font-semibold">{a.teamName}</h3>
                        {snap ? (
                          <>
                            <p className="text-sm text-muted-foreground">{snap.summary}</p>
                            <div className="flex flex-wrap gap-1">
                              {snap.techStack.map((t, i) => (
                                <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t}</span>
                              ))}
                            </div>
                            {snap.features && snap.features.length > 0 ? (
                              <div className="space-y-2 pt-2 border-t border-border/30">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Features & Working Status</p>
                                <div className="grid gap-2">
                                  {snap.features.map((feat, idx) => {
                                    let badgeClass = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
                                    if (feat.status === "Working") badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                                    else if (feat.status === "Partially Implemented") badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                                    else if (feat.status === "Mocked/Planned") badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";

                                    return (
                                      <div key={idx} className="flex flex-col gap-1 rounded-lg bg-secondary/20 p-2.5 border border-border/20">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold text-xs text-foreground">{feat.name}</span>
                                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${badgeClass}`}>
                                            {feat.status}
                                          </span>
                                        </div>
                                        {feat.details && (
                                          <p className="text-[11px] text-muted-foreground leading-normal">{feat.details}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                                {snap.keyFeatures.map((f, i) => <li key={i}>{f}</li>)}
                              </ul>
                            )}
                            <p className="text-[10px] text-muted-foreground">Cached: {new Date(snap.cachedAt).toLocaleString()}</p>
                          </>
                        ) : (
                          <button onClick={() => handleGenerateSnapshot(a)} disabled={snapshotLoading === a.teamId}
                            className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50">
                            {snapshotLoading === a.teamId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Generate Snapshot
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="questions">
              <div className="glass-card flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 680 }}>
                <div className="border-b border-border/50 px-6 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold">Ask About a Project</h2>
                  </div>
                  <select
                    value={selectedAssignment?.teamId || ""}
                    onChange={(e) => {
                      const a = assignments.find((a) => a.teamId === e.target.value);
                      if (a) handleSelectForChat(a);
                    }}
                    className="w-full max-w-md rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Select a team's repo...</option>
                    {assignments.filter((a) => a.githubUrl).map((a) => (
                      <option key={a.teamId} value={a.teamId}>
                        {a.teamName} — {a.githubUrl}
                      </option>
                    ))}
                  </select>
                  {chatRepoContent && (
                    <p className="mt-1.5 text-xs text-success flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> README loaded — AI answering from actual code
                    </p>
                  )}
                  {selectedAssignment && !chatRepoContent && selectedAssignment.githubUrl && (
                    <p className="mt-1.5 text-xs text-warning flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> README unavailable — limited context
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Bot className="h-12 w-12 mb-4 text-muted-foreground/30" />
                      <p className="text-sm">Select a repo and ask a question</p>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${m.role === "assistant" ? "bg-secondary" : "bg-primary/10"}`}>
                        <div className="space-y-1">{renderFormattedMessage(m.content)}</div>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-xl bg-secondary px-4 py-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t border-border/50 p-4">
                  <div className="flex gap-2">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                      placeholder={selectedAssignment ? "Ask about this project..." : "Select a repo first"}
                      disabled={!selectedAssignment || chatLoading}
                      className="flex-1 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50" />
                    <button onClick={handleChatSend} disabled={!selectedAssignment || chatLoading || !chatInput.trim()}
                      className="shrink-0 rounded-lg bg-primary p-2.5 text-primary-foreground disabled:opacity-50">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
