// =============================================================================
// GrievanceSupport.tsx — Feature 2: Student grievance submission + AI help
// Students can submit, track grievances. AI chatbot moved here from admin.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import {
    LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck,
    HelpCircle, Send, PlusCircle, Bot, Loader2, FileText, Linkedin
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
    getUserRegistrations,
    getTickets,
    createTicket,
    type Ticket,
} from "@/lib/storage";
import { helplineChat, isAIAvailable } from "@/lib/ai";

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
    Open: "bg-warning/10 text-warning",
    "In Progress": "bg-primary/10 text-primary",
    Resolved: "bg-success/10 text-success",
};

const CATEGORIES = ["Registration", "PPT", "Verification", "Technical", "Other"] as const;

export default function GrievanceSupport() {
    const { user } = useAuth();
    const [tab, setTab] = useState<"grievances" | "ai">("grievances");
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", category: "Other" as Ticket["category"], hackathonId: "" });
    const [myHackathons, setMyHackathons] = useState<{ id: string; name: string }[]>([]);

    // AI chatbot state
    const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);

    useEffect(() => {
        if (!user?.email) return;
        const regs = getUserRegistrations(user.email);
        setMyHackathons(regs.map((r) => ({ id: r.hackathonId, name: r.hackathonName })));
        if (regs.length > 0) setForm((f) => ({ ...f, hackathonId: regs[0].hackathonId }));
        loadTickets();
        const iv = setInterval(loadTickets, 5000);
        return () => clearInterval(iv);
    }, [user]);

    const loadTickets = () => {
        if (!user?.email) return;
        setTickets(getTickets(user.email));
    };

    const handleSubmit = () => {
        if (!form.title.trim() || !form.description.trim()) {
            toast({ title: "Fill all fields", variant: "destructive" }); return;
        }
        const ticket: Ticket = {
            id: `T-${crypto.randomUUID().slice(0, 8)}`,
            subject: form.title.trim(),
            category: form.category,
            hackathonId: form.hackathonId || "global",
            status: "Open",
            studentName: user?.name || user?.email?.split("@")[0] || "Unknown",
            studentEmail: user?.email || "",
            messages: [{
                from: "student",
                text: form.description.trim(),
                time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
            }],
            createdAt: new Date().toISOString(),
        };
        createTicket(ticket);
        setTickets((prev) => [ticket, ...prev]);
        setCreating(false);
        setForm({ title: "", description: "", category: "Other", hackathonId: myHackathons[0]?.id || "" });
        toast({ title: "Ticket created!" });
    };

    const handleChatSend = async () => {
        if (!chatInput.trim()) return;
        const msgText = chatInput.trim();
        const msg = { role: "user" as const, content: msgText };
        setChatMessages((prev) => [...prev, msg]);
        setChatInput("");
        setChatLoading(true);
        try {
            const res = await helplineChat(msgText, chatMessages.map((m) => ({ role: m.role, content: m.content })));

            // Detect ACTION:CREATE_TICKET protocol
            if (res.startsWith("ACTION:CREATE_TICKET|") || res.includes("CREATE_TICKET|")) {
                const cleanRes = res.includes("ACTION:") ? res : "ACTION:" + res;
                const parts = cleanRes.split("|");
                const subject = parts[1] || "Support Request";
                const category = (parts[2] || "Other") as any;

                const ticket: Ticket = {
                    id: `T-${crypto.randomUUID().slice(0, 8)}`,
                    subject,
                    category,
                    hackathonId: myHackathons[0]?.id || "global",
                    status: "Open",
                    studentName: user?.name || user?.email?.split("@")[0] || "Unknown",
                    studentEmail: user?.email || "",
                    messages: [{
                        from: "student",
                        text: msgText,
                        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                    }],
                    createdAt: new Date().toISOString(),
                };
                createTicket(ticket);
                setTickets((prev) => [ticket, ...prev]);

                setChatMessages((prev) => [...prev, {
                    role: "assistant",
                    content: `✅ Ticket created: **${subject}** (Category: ${category})\n\nYou'll see it in the Grievances tab. Our team will respond shortly.`,
                }]);
            } else {
                setChatMessages((prev) => [...prev, { role: "assistant", content: res }]);
            }
        } catch (err: any) {
            setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Student" />
            <main className="flex-1 p-6 md:p-8">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="mb-1 font-display text-2xl font-bold">Grievance & Support</h1>
                            <p className="text-sm text-muted-foreground">Submit issues or chat with AI for instant help</p>
                        </div>
                    </div>

                    {/* Tab toggle */}
                    <div className="mb-6 flex gap-2">
                        <button onClick={() => setTab("grievances")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "grievances" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                            <FileText className="mr-1.5 inline h-4 w-4" /> Grievances
                        </button>
                        {isAIAvailable() && (
                            <button onClick={() => setTab("ai")}
                                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                                <Bot className="mr-1.5 inline h-4 w-4" /> AI Help
                            </button>
                        )}
                    </div>

                    {tab === "grievances" ? (
                        <>
                            {/* Submit button */}
                            {!creating && (
                                <button onClick={() => setCreating(true)}
                                    className="mb-6 flex items-center gap-1.5 btn-primary-glow px-4 py-2 text-sm font-bold">
                                    <PlusCircle className="h-4 w-4" /> New Grievance
                                </button>
                            )}

                            {/* Create form */}
                            {creating && (
                                <div className="glass-card mb-6 space-y-4 p-6">
                                    <h2 className="font-display text-lg font-semibold">Submit Grievance</h2>
                                    <input type="text" placeholder="Title / Subject" value={form.title}
                                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none" />
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                                            className="rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none">
                                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        {myHackathons.length > 0 && (
                                            <select value={form.hackathonId} onChange={(e) => setForm((f) => ({ ...f, hackathonId: e.target.value }))}
                                                className="rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none">
                                                {myHackathons.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <textarea rows={4} placeholder="Describe your issue in detail..." value={form.description}
                                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none" />
                                    <div className="flex gap-2">
                                        <button onClick={handleSubmit} className="btn-primary-glow px-6 py-2 text-sm font-bold">Submit</button>
                                        <button onClick={() => setCreating(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Ticket list */}
                            <div className="space-y-3">
                                {tickets.length === 0 ? (
                                    <div className="glass-card p-12 text-center text-muted-foreground">
                                        <HelpCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
                                        <p className="text-sm">No grievances submitted yet.</p>
                                    </div>
                                ) : (
                                    tickets.map((t) => (
                                        <div key={t.id} className="glass-card p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-sm font-semibold">{t.subject}</h3>
                                                        <Badge className={statusColors[t.status]} variant="secondary">{t.status}</Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mb-2">{t.category} · {t.hackathonId !== "global" ? myHackathons.find(h => h.id === t.hackathonId)?.name || t.hackathonId : "General"} · {new Date(t.createdAt).toLocaleDateString()}</p>
                                                    <p className="text-sm text-muted-foreground">{t.messages[0]?.text}</p>

                                                    {/* Display admin replies */}
                                                    {t.messages.filter(m => m.from === "admin").map((m, idx) => (
                                                        <div key={idx} className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                                                            <p className="text-xs font-semibold text-primary mb-1">Admin Response ({m.time}):</p>
                                                            <p className="text-sm">{m.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        /* AI Chat tab */
                        <div className="glass-card flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
                            <div className="border-b border-border/50 px-6 py-4 flex items-center gap-2">
                                <Bot className="h-5 w-5 text-primary" />
                                <h2 className="font-display text-lg font-semibold">AI Support Assistant</h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                        <Bot className="h-12 w-12 mb-4 text-muted-foreground/30" />
                                        <p className="text-sm">Ask anything about registration, submissions, or hackathon rules</p>
                                    </div>
                                )}
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
                                        <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${m.role === "assistant" ? "bg-secondary" : "bg-primary/10"}`}>
                                            <p className="whitespace-pre-wrap">{m.content}</p>
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex justify-start">
                                        <div className="rounded-xl bg-secondary px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-border/50 p-4">
                                <div className="flex gap-2">
                                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleChatSend()} placeholder="Ask a question..."
                                        disabled={chatLoading}
                                        className="flex-1 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50" />
                                    <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                                        className="shrink-0 rounded-lg bg-primary p-2.5 text-primary-foreground disabled:opacity-50">
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
}
