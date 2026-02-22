// =============================================================================
// GitHubRepo.tsx — Student GitHub URL submission page
// Validates GitHub URLs, prevents empty, allows editing.
// Saves to localStorage via storage.ts (accessible by judges).
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck, CheckCircle, Edit3, ExternalLink, HelpCircle, Linkedin } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
    getGitHubSubmission,
    setGitHubSubmission,
    findUserRegistration,
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

// GitHub URL validation regex
const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

export default function GitHubRepo() {
    const { user } = useAuth();
    const [url, setUrl] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [editing, setEditing] = useState(false);
    const [savedUrl, setSavedUrl] = useState("");
    const [hackathonId, setHackathonId] = useState("");

    // Load existing submission on mount
    useEffect(() => {
        if (!user?.email) return;
        const reg = findUserRegistration(user.email);
        if (reg) {
            setHackathonId(reg.hackathonId);
            const existing = getGitHubSubmission(user.email, reg.hackathonId);
            if (existing) {
                setSavedUrl(existing.url);
                setUrl(existing.url);
                setSubmitted(true);
            }
        }
    }, [user]);

    // Handle submission
    const handleSubmit = () => {
        // Validate: cannot be empty
        if (!url.trim()) {
            toast({ title: "URL Required", description: "Please enter a GitHub repository URL.", variant: "destructive" });
            return;
        }

        // Validate: must be a valid GitHub URL
        if (!GITHUB_URL_REGEX.test(url.trim())) {
            toast({
                title: "Invalid URL",
                description: "Please enter a valid GitHub URL (e.g. https://github.com/user/repo)",
                variant: "destructive",
            });
            return;
        }

        // Save to localStorage
        setGitHubSubmission({
            hackathonId: hackathonId || "default",
            userEmail: user?.email || "",
            url: url.trim(),
            submittedAt: new Date().toISOString(),
        });

        setSavedUrl(url.trim());
        setSubmitted(true);
        setEditing(false);
        toast({ title: "Repository Submitted!", description: "Your GitHub URL has been saved successfully." });
    };

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Student" />
            <main className="flex-1 p-6 md:p-8">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h1 className="mb-1 font-display text-2xl font-bold">Project Repository</h1>
                    <p className="mb-8 text-sm text-muted-foreground">
                        Submit your GitHub repository URL. Judges will review this.
                    </p>

                    <div className="glass-card max-w-xl p-6 space-y-5">
                        {/* Show submitted state */}
                        {submitted && !editing ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-success">
                                    <CheckCircle className="h-5 w-5" />
                                    <span className="font-semibold text-sm">Repository Submitted</span>
                                </div>

                                <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                                    <p className="text-xs text-muted-foreground mb-1">Submitted URL</p>
                                    <a
                                        href={savedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm font-medium text-primary hover:underline break-all"
                                    >
                                        {savedUrl}
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                    </a>
                                </div>

                                <button
                                    onClick={() => setEditing(true)}
                                    className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <Edit3 className="h-4 w-4" /> Edit Submission
                                </button>
                            </div>
                        ) : (
                            /* Input form */
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        GitHub Repository URL
                                    </label>
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://github.com/username/repository"
                                        className="mt-1.5 w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Must be a valid GitHub repository URL
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSubmit}
                                        className="btn-primary-glow px-8 py-3 text-sm font-bold"
                                    >
                                        {editing ? "UPDATE REPO" : "SUBMIT REPO"}
                                    </button>
                                    {editing && (
                                        <button
                                            onClick={() => { setEditing(false); setUrl(savedUrl); }}
                                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
