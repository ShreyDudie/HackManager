// =============================================================================
// LinkedInPost.tsx — Feature 4: Auto-generate LinkedIn post after hackathon
// Editable preview, copy to clipboard, download as .txt. No OAuth required.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import {
    LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck,
    HelpCircle, Linkedin, Sparkles, Copy, Download, Loader2, Check
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import {
    getUserRegistrations,
    getHackathon,
    getGitHubSubmission,
    getLinkedInPost,
    saveLinkedInPost,
    type Registration,
    type Hackathon,
} from "@/lib/storage";
import { generateLinkedInPost, isAIAvailable } from "@/lib/ai";

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

export default function LinkedInPostPage() {
    const { user } = useAuth();
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [activeHackathonId, setActiveHackathonId] = useState("");
    const [postContent, setPostContent] = useState("");
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [role, setRole] = useState<"Participant" | "Winner" | "Organizer">("Participant");


    useEffect(() => {
        if (!user?.email) return;
        const regs = getUserRegistrations(user.email);
        setRegistrations(regs);
        const saved = localStorage.getItem("sq_active_hackathon_" + user.email);
        const activeId = saved && regs.find((r) => r.hackathonId === saved) ? saved : regs[0]?.hackathonId || "";
        setActiveHackathonId(activeId);
    }, [user]);

    // Load cached post when hackathon changes
    useEffect(() => {
        if (!user?.email || !activeHackathonId) return;
        const cached = getLinkedInPost(user.email, activeHackathonId);
        if (cached) setPostContent(cached.content);
        else setPostContent("");
    }, [user, activeHackathonId]);

    const handleGenerate = async () => {
        if (!isAIAvailable()) {
            toast({ title: "AI Not Available", description: "Set VITE_GROQ_API_KEY in .env.local", variant: "destructive" });
            return;
        }
        if (!user?.email || !activeHackathonId) return;

        setGenerating(true);
        const reg = registrations.find((r) => r.hackathonId === activeHackathonId);
        const hackathon = getHackathon(activeHackathonId);
        const github = getGitHubSubmission(user.email, activeHackathonId);

        try {
            // Fix 7: Map status to position, include new fields
            const hackathonRegs = registrations.filter((r) => r.hackathonId === activeHackathonId);
            const statusMap: Record<string, string> = {
                "Winner": "Winner", "Shortlisted": "Finalist",
                "Verified": "Participant", "In Process": "Participant",
                "Rejected": "Participant",
            };
            const position = statusMap[reg?.status || ""] || "Participant";

            const content = await generateLinkedInPost({
                eventName: hackathon?.name || "Hackathon",
                teamName: reg?.teamName || "",
                position,
                techStack: "",
                githubUrl: github?.url || "",
                college: reg?.members?.[0]?.college || "",
                userName: user.name || user.email.split("@")[0],
                totalTeams: hackathon?.teams || hackathonRegs.length,
                projectName: reg?.teamName || "",
                role,
            });
            setPostContent(content);
            saveLinkedInPost({
                userEmail: user.email,
                hackathonId: activeHackathonId,
                content,
                generatedAt: new Date().toISOString(),
            });
            toast({ title: "Post Generated!" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(postContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Copied to clipboard!" });
    };

    const handleDownload = () => {
        const blob = new Blob([postContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "linkedin_post.txt"; a.click();
        URL.revokeObjectURL(url);
    };

    if (registrations.length === 0) {
        return (
            <div className="flex min-h-screen pt-16">
                <DashboardSidebar items={sidebarItems} title="Student" />
                <main className="flex-1 p-6 flex items-center justify-center">
                    <div className="glass-card p-12 text-center text-muted-foreground">
                        <Linkedin className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
                    <h1 className="mb-1 font-display text-2xl font-bold">LinkedIn Post Generator</h1>
                    <p className="mb-6 text-sm text-muted-foreground">Generate a personalized post to share your hackathon experience</p>

                    {/* Hackathon switcher */}
                    {registrations.length > 1 && (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {registrations.map((r) => (
                                <button key={r.hackathonId} onClick={() => {
                                    setActiveHackathonId(r.hackathonId);
                                    if (user?.email) localStorage.setItem("sq_active_hackathon_" + user.email, r.hackathonId);
                                }}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeHackathonId === r.hackathonId ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                                        }`}>
                                    {r.hackathonName}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Role Selection */}
                    <div className="mb-6 flex gap-2">
                        {(["Participant", "Winner", "Organizer"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRole(r)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${role === r ? "bg-primary/20 text-primary border border-primary/50" : "bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {/* Generate button */}
                    <div className="glass-card p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                                <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                                {registrations.find((r) => r.hackathonId === activeHackathonId)?.hackathonName || "Post"}
                            </h2>
                            <button onClick={handleGenerate} disabled={generating}
                                className="flex items-center gap-1.5 btn-primary-glow px-4 py-2 text-sm font-bold disabled:opacity-50">
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {postContent ? "Regenerate" : "Generate Post"}
                            </button>
                        </div>

                        {postContent ? (
                            <>
                                <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={14}
                                    className="w-full rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm leading-relaxed focus:border-primary focus:outline-none" />
                                <div className="mt-4 flex gap-2">
                                    <button onClick={handleCopy}
                                        className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10">
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                    <button onClick={handleDownload}
                                        className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                                        <Download className="h-4 w-4" /> Download .txt
                                    </button>
                                </div>
                                <p className="mt-3 text-xs text-muted-foreground">Edit the text above before copying. Your changes are auto-saved.</p>
                            </>
                        ) : (
                            <div className="py-12 text-center text-muted-foreground">
                                <Linkedin className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
                                <p className="text-sm">Click "Generate Post" to create your LinkedIn post</p>
                                <p className="mt-1 text-xs">Uses AI to craft a professional post about your hackathon participation</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
