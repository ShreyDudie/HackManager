// =============================================================================
// PPTUpload.tsx — Fix 3: Changed from link-only to PDF upload + link
// Students can now upload a PDF file (stored as base64 in localStorage).
// Judges can view the PDF directly from JudgeDashboard.
// Link submission still available as fallback for Google Slides etc.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import {
  LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck,
  CheckCircle, ExternalLink, FileText, File, Trash2, HelpCircle, Linkedin
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  getUserRegistrations,
  getHackathon,
  getPPTSubmissions,
  setPPTSubmission,
  type PPTSubmission,
  type Round,
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

const MAX_PDF_SIZE_MB = 10;
const URL_REGEX = /^https?:\/\/.+\..+/i;

export default function PPTUpload() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-hackathon
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [activeHackathonId, setActiveHackathonId] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [submissions, setSubmissions] = useState<PPTSubmission[]>([]);

  // Editing state
  const [editingRound, setEditingRound] = useState<string | null>(null);
  const [pptName, setPptName] = useState("");
  const [pptLink, setPptLink] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"pdf" | "link">("pdf");

  // Load data
  useEffect(() => {
    if (!user?.email) return;
    const regs = getUserRegistrations(user.email);
    setRegistrations(regs);
    const saved = localStorage.getItem("sq_active_hackathon_" + user.email);
    const activeId = saved && regs.find((r: any) => r.hackathonId === saved) ? saved : regs[0]?.hackathonId || "";
    setActiveHackathonId(activeId);
  }, [user]);

  useEffect(() => {
    if (!user?.email || !activeHackathonId) return;
    const hackathon = getHackathon(activeHackathonId);
    if (hackathon?.rounds?.length) {
      setRounds(hackathon.rounds);
    } else {
      setRounds([{ id: "default", name: "Submission", description: "Submit your presentation", deadline: "", submissionType: "PPT", shortlist: false }]);
    }
    setSubmissions(getPPTSubmissions(user.email, activeHackathonId));
  }, [user, activeHackathonId]);

  // Handle PDF file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "PDF Only", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }

    if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
      toast({ title: "Too Large", description: `Max file size is ${MAX_PDF_SIZE_MB}MB.`, variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPdfBase64(reader.result as string);
      setPdfFileName(file.name);
      setPptName(file.name.replace(/\.pdf$/i, ""));
    };
    reader.readAsDataURL(file);
  };

  // Handle submission
  const handleSubmit = async (roundId: string) => {
    let finalPdfUrl = null;
    let finalPdfBase64 = null;

    if (uploadMode === "pdf") {
      if (!pdfBase64) {
        toast({ title: "No PDF", description: "Please select a PDF file.", variant: "destructive" });
        return;
      }

      // Perform REAL file upload to Django
      try {
        const file = fileInputRef.current?.files?.[0];
        if (file) {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("http://localhost:8000/api/auth/pdf-upload/", {
            method: "POST",
            body: formData,
            // Header for Content-Type is set automatically by fetch for FormData
          });

          if (!response.ok) throw new Error("Upload failed");
          const data = await response.json();
          finalPdfUrl = data.url;
          toast({ title: "File Uploaded", description: "PDF saved to server successfully." });
        }
      } catch (err) {
        toast({ title: "Server Upload Failed", description: "Storing locally as fallback.", variant: "destructive" });
        finalPdfBase64 = pdfBase64; // Fallback to base64 if server is down
      }
    } else {
      if (!pptLink.trim() || !URL_REGEX.test(pptLink.trim())) {
        toast({ title: "Invalid Link", description: "Enter a valid URL.", variant: "destructive" });
        return;
      }
    }

    if (!pptName.trim()) {
      toast({ title: "Name Required", description: "Enter a name for the submission.", variant: "destructive" });
      return;
    }

    const newSub: PPTSubmission = {
      hackathonId: activeHackathonId || "default",
      userEmail: user?.email || "",
      roundId,
      name: pptName.trim(),
      link: uploadMode === "link" ? pptLink.trim() : "",
      pdfBase64: finalPdfBase64,
      pdfUrl: finalPdfUrl,
      pdfFileName: uploadMode === "pdf" ? pdfFileName : null,
      submittedAt: new Date().toISOString(),
    };

    setPPTSubmission(newSub);
    setSubmissions((prev) => {
      const idx = prev.findIndex((s) => s.roundId === roundId);
      if (idx !== -1) { const u = [...prev]; u[idx] = newSub; return u; }
      return [...prev, newSub];
    });

    setEditingRound(null);
    setPptName(""); setPptLink(""); setPdfBase64(null); setPdfFileName(null);
    toast({ title: "Submitted!", description: `${pptName} saved.` });
  };

  // View PDF in new tab
  const viewPDF = (sub: PPTSubmission) => {
    if (sub.pdfUrl) {
      window.open(sub.pdfUrl, "_blank");
    } else if (sub.pdfBase64) {
      const win = window.open();
      if (win) {
        win.document.write(`
          <html><head><title>${sub.name}</title></head>
          <body style="margin:0"><iframe src="${sub.pdfBase64}" style="width:100%;height:100vh;border:none"></iframe></body></html>
        `);
      }
    } else if (sub.link) {
      window.open(sub.link, "_blank");
    }
  };

  if (registrations.length === 0) {
    return (
      <div className="flex min-h-screen pt-16">
        <DashboardSidebar items={sidebarItems} title="Student" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="glass-card p-12 text-center text-muted-foreground">
            <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm">Register for a hackathon first.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Student" />
      <main className="flex-1 p-6 md:p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="mb-1 font-display text-2xl font-bold">PPT Submissions</h1>
          <p className="mb-6 text-sm text-muted-foreground">Upload PDF or share a presentation link</p>

          {/* Hackathon switcher */}
          {registrations.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {registrations.map((r: any) => (
                <button key={r.hackathonId} onClick={() => {
                  setActiveHackathonId(r.hackathonId);
                  if (user?.email) localStorage.setItem("sq_active_hackathon_" + user.email, r.hackathonId);
                }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeHackathonId === r.hackathonId ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                    }`}
                >
                  {r.hackathonName}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4 max-w-2xl">
            {rounds.map((r) => {
              const sub = submissions.find((s) => s.roundId === r.id);
              const isEditing = editingRound === r.id;

              return (
                <div key={r.id} className="glass-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-display font-semibold">{r.name}</p>
                      {r.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Deadline: {new Date(r.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}

                      {/* Existing submission */}
                      {sub && !isEditing && (
                        <div className="mt-3 rounded-lg border border-success/20 bg-success/5 p-3">
                          <div className="flex items-center gap-1.5 text-success mb-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">
                              {sub.pdfBase64 ? "PDF Uploaded" : "Link Submitted"}
                            </span>
                          </div>
                          <button onClick={() => viewPDF(sub)}
                            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                            {sub.pdfBase64 ? <FileText className="h-3.5 w-3.5" /> : <ExternalLink className="h-3 w-3" />}
                            {sub.name}
                            {sub.pdfFileName && <span className="text-xs text-muted-foreground ml-1">({sub.pdfFileName})</span>}
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => {
                          setEditingRound(r.id);
                          if (sub) {
                            setPptName(sub.name);
                            setPptLink(sub.link || "");
                            setPdfBase64(sub.pdfBase64 || null);
                            setPdfFileName(sub.pdfFileName || null);
                            setUploadMode(sub.pdfBase64 ? "pdf" : "link");
                          } else {
                            setPptName(""); setPptLink(""); setPdfBase64(null); setPdfFileName(null);
                            setUploadMode("pdf");
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                      >
                        <Upload className="h-4 w-4" />
                        {sub ? "Edit" : "Upload PPT"}
                      </button>
                    )}
                  </div>

                  {/* Edit form */}
                  {isEditing && (
                    <div className="mt-4 space-y-4 border-t border-border/30 pt-4">
                      {/* Mode toggle */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUploadMode("pdf")}
                          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${uploadMode === "pdf" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            }`}
                        >
                          <File className="h-4 w-4" /> Upload PDF
                        </button>
                        <button
                          onClick={() => setUploadMode("link")}
                          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${uploadMode === "link" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            }`}
                        >
                          <ExternalLink className="h-4 w-4" /> Share Link
                        </button>
                      </div>

                      {uploadMode === "pdf" ? (
                        /* PDF Upload */
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">PDF File (max {MAX_PDF_SIZE_MB}MB)</label>
                          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect}
                            className="hidden" />
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                          >
                            {pdfFileName ? (
                              <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                <span className="text-sm font-medium text-foreground">{pdfFileName}</span>
                                <button onClick={(e) => { e.stopPropagation(); setPdfBase64(null); setPdfFileName(null); }}
                                  className="ml-2 text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            ) : (
                              <>
                                <Upload className="h-5 w-5" />
                                <span className="text-sm">Click to select PDF</span>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Link input */
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">PPT Link</label>
                          <input type="url" value={pptLink} onChange={(e) => setPptLink(e.target.value)}
                            placeholder="https://docs.google.com/presentation/d/..."
                            className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none" />
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Submission Name</label>
                        <input type="text" value={pptName} onChange={(e) => setPptName(e.target.value)}
                          placeholder="e.g. Round1_Ideation_Pitch"
                          className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none" />
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleSubmit(r.id)} className="btn-primary-glow px-6 py-2 text-sm font-bold">SAVE</button>
                        <button onClick={() => { setEditingRound(null); setPptName(""); setPptLink(""); setPdfBase64(null); setPdfFileName(null); }}
                          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
