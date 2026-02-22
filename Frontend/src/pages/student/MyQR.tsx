// =============================================================================
// MyQR.tsx — Student QR Code page (Patch 3: real react-qr-code library)
// Registration QR: TOTP-like 30s rotating token encoded as JSON in QR.
// Meal QRs: one-time-use per meal per day, standard QR scannable by phone.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import {
    LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck,
    Shield, Utensils, CheckCircle, Clock, RefreshCw, HelpCircle, Linkedin
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";
import {
    findRegistration,
    getUserRegistrations,
    getQRTokens,
    addQRToken,
    addQRScanLog,
    lockEntryQR,
    sha256,
    type QRToken,
    type QRScanLog,
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

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const MEAL_LABELS: Record<string, string> = {
    breakfast: "🌅 Breakfast",
    lunch: "☀️ Lunch",
    dinner: "🌙 Dinner",
};

export default function MyQR() {
    const { user } = useAuth();

    // Multi-hackathon support: pick active hackathon
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [activeHackathonId, setActiveHackathonId] = useState<string>("");

    // QR state
    const [qrPayload, setQrPayload] = useState("");
    const [countdown, setCountdown] = useState(60);
    const [mealTokens, setMealTokens] = useState<QRToken[]>([]);

    const [currentDay, setCurrentDay] = useState(1);
    const [hackathonDays] = useState(2);
    const [regVerified, setRegVerified] = useState(false);
    const [regUsed, setRegUsed] = useState(false);

    // Load all user registrations
    useEffect(() => {
        if (!user?.email) return;
        const regs = getUserRegistrations(user.email);
        setRegistrations(regs);
        // Restore active hackathon from localStorage or default to first
        const saved = localStorage.getItem("sq_active_hackathon_" + user.email);
        const firstId = regs[0]?.hackathonId || "";
        const activeId = saved && regs.find((r) => r.hackathonId === saved) ? saved : firstId;
        setActiveHackathonId(activeId);
    }, [user]);

    // Generate QR token for active hackathon
    const generateQR = useCallback(async () => {
        if (!user?.email || !activeHackathonId) return;
        const reg = findRegistration(user.email, activeHackathonId);
        if (!reg) return;

        setRegVerified(reg.status === "Verified");
        setRegUsed(reg.qrTokenUsed);

        // TOTP-like: token changes every 60s
        const timePeriod = Math.floor(Date.now() / 60000);
        const raw = `${reg.teamName}|${reg.userEmail}|${activeHackathonId}|${timePeriod}`;
        const hash = await sha256(raw);

        // QR encodes a JSON payload — scannable by any camera
        const payload = JSON.stringify({
            hackathonId: activeHackathonId,
            userId: reg.userEmail,
            teamName: reg.teamName,
            type: "registration",
            timestamp: timePeriod,
            hash: hash.slice(0, 16), // truncated for QR size
        });
        setQrPayload(payload);

        // Feature 1: Log QR generation as a scan event for admin monitoring
        addQRScanLog({
            id: crypto.randomUUID().slice(0, 8),
            hackathonId: activeHackathonId,
            userEmail: reg.userEmail,
            teamName: reg.teamName,
            tokenType: "registration",
            tokenHash: hash.slice(0, 12) + "...",
            result: reg.qrTokenUsed ? "duplicate" : "valid",
            scannedAt: new Date().toISOString(),
        });

        // Load meal tokens
        const tokens = getQRTokens(user.email, activeHackathonId);
        setMealTokens(tokens);
    }, [user, activeHackathonId]);

    // Refresh every second for countdown, regenerate on 0
    useEffect(() => {
        if (!activeHackathonId) return;
        generateQR();

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    generateQR();
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [generateQR, activeHackathonId]);

    // Save active hackathon selection
    const handleHackathonSwitch = (hackathonId: string) => {
        setActiveHackathonId(hackathonId);
        if (user?.email) localStorage.setItem("sq_active_hackathon_" + user.email, hackathonId);
        setCountdown(60);
    };

    // Fix 5: Only allow meal token generation if entry QR has been scanned
    const generateMealTokens = async (day: number) => {
        if (!user?.email || !activeHackathonId) return;

        // Check entry QR is locked first
        const reg = findRegistration(user.email, activeHackathonId);
        if (!reg?.qrTokenUsed) {
            toast({ title: "Entry Not Scanned", description: "Your entry QR must be scanned first before generating meal tokens.", variant: "destructive" });
            return;
        }

        const existing = mealTokens.filter((t) => t.day === day);
        if (existing.length >= 3) {
            toast({ title: "Already Generated", description: `Meal tokens for Day ${day} exist.` });
            return;
        }

        for (const mealType of MEAL_TYPES) {
            const hash = await sha256(`meal|${user.email}|${activeHackathonId}|${mealType}|day${day}|${Date.now()}`);
            addQRToken({
                id: crypto.randomUUID().slice(0, 8),
                hackathonId: activeHackathonId,
                userEmail: user.email,
                type: mealType,
                day,
                token: hash,
                used: false,
                createdAt: new Date().toISOString(),
            });
        }

        const updated = getQRTokens(user.email, activeHackathonId);
        setMealTokens(updated);
        toast({ title: "Meal Tokens Generated", description: `3 tokens ready for Day ${day}` });
    };

    if (registrations.length === 0) {
        return (
            <div className="flex min-h-screen pt-16">
                <DashboardSidebar items={sidebarItems} title="Student" />
                <main className="flex-1 p-6 md:p-8">
                    <div className="glass-card flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground">
                        <QrCode className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-sm">Register for a hackathon first to get your QR codes.</p>
                    </div>
                </main>
            </div>
        );
    }

    const activeName = registrations.find((r) => r.hackathonId === activeHackathonId)?.hackathonName || "Hackathon";

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Student" />
            <main className="flex-1 p-6 md:p-8">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h1 className="mb-1 font-display text-2xl font-bold">My QR Codes</h1>
                    <p className="mb-6 text-sm text-muted-foreground">Digital entry pass and meal tokens</p>

                    {/* Hackathon switcher (multi-hackathon support) */}
                    {registrations.length > 1 && (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {registrations.map((r) => (
                                <button
                                    key={r.hackathonId}
                                    onClick={() => handleHackathonSwitch(r.hackathonId)}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeHackathonId === r.hackathonId
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary hover:bg-secondary/80"
                                        }`}
                                >
                                    {r.hackathonName}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Registration QR ── */}
                    <div className="glass-card mb-6 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="h-5 w-5 text-primary" />
                            <h2 className="font-display text-lg font-semibold">Registration QR — {activeName}</h2>
                        </div>
                        <p className="text-xs text-muted-foreground mb-6">
                            Present this at the registration desk. Refreshes every 60s for security. Scannable by any phone camera.
                        </p>

                        <div className="flex flex-col items-center gap-4">
                            {regUsed ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <CheckCircle className="h-5 w-5 text-success" />
                                    <span className="text-sm font-semibold">QR Used — Entry Recorded</span>
                                </div>
                            ) : qrPayload ? (
                                <>
                                    {/* Real QR Code — scannable by phone camera */}
                                    <div className="rounded-2xl bg-white p-4 shadow-lg">
                                        <QRCode
                                            value={qrPayload}
                                            size={200}
                                            level="M"
                                            fgColor="#18181b"
                                            bgColor="#ffffff"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-primary">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-sm font-semibold">Refreshes in {countdown}s</span>
                                        <button
                                            onClick={() => { generateQR(); setCountdown(60); }}
                                            className="ml-1 text-muted-foreground hover:text-foreground"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-muted-foreground">Generating QR...</div>
                            )}
                        </div>
                    </div>

                    {/* ── Meal QR Tokens ── */}
                    {regVerified ? (
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Utensils className="h-5 w-5 text-primary" />
                                <h2 className="font-display text-lg font-semibold">Meal Tokens</h2>
                            </div>

                            {/* Day tabs */}
                            <div className="flex gap-2 mb-6">
                                {Array.from({ length: hackathonDays }, (_, i) => i + 1).map((day) => (
                                    <button
                                        key={day}
                                        onClick={() => setCurrentDay(day)}
                                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${currentDay === day ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                                            }`}
                                    >
                                        Day {day}
                                    </button>
                                ))}
                            </div>

                            {/* Meal tokens for current day */}
                            {(() => {
                                const dayTokens = mealTokens.filter((t) => t.day === currentDay);
                                if (dayTokens.length === 0) {
                                    return (
                                        <div className="text-center py-8">
                                            <p className="mb-4 text-sm text-muted-foreground">No meal tokens for Day {currentDay} yet.</p>
                                            <button
                                                onClick={() => generateMealTokens(currentDay)}
                                                className="btn-primary-glow px-6 py-2 text-sm font-bold"
                                            >
                                                GENERATE MEAL TOKENS
                                            </button>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="grid gap-6 sm:grid-cols-3">
                                        {MEAL_TYPES.map((mealType) => {
                                            const token = dayTokens.find((t) => t.type === mealType);
                                            if (!token) return null;

                                            // Meal QR payload
                                            const mealPayload = JSON.stringify({
                                                hackathonId: activeHackathonId,
                                                userId: user?.email,
                                                type: mealType,
                                                day: token.day,
                                                tokenId: token.id,
                                                hash: token.token.slice(0, 16),
                                            });

                                            return (
                                                <div
                                                    key={token.id}
                                                    className={`rounded-2xl border-2 p-4 text-center ${token.used ? "border-muted bg-muted/20 opacity-60" : "border-primary/30 bg-secondary/30"
                                                        }`}
                                                >
                                                    <p className="text-xs font-semibold text-muted-foreground mb-3">{MEAL_LABELS[mealType]}</p>
                                                    {token.used ? (
                                                        <div className="flex flex-col items-center gap-2 py-4">
                                                            <CheckCircle className="h-8 w-8 text-success" />
                                                            <span className="text-xs font-semibold text-muted-foreground">USED</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-center">
                                                            <div className="rounded-xl bg-white p-2">
                                                                <QRCode value={mealPayload} size={120} level="M" fgColor="#18181b" bgColor="#ffffff" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            <p className="mt-4 text-xs text-muted-foreground text-center">
                                ⚠️ Each QR can only be scanned once. Screenshots won't work.
                            </p>
                        </div>
                    ) : (
                        <div className="glass-card p-6 text-center text-muted-foreground">
                            <p className="text-sm">🔒 Meal tokens will appear after your registration is verified by the admin.</p>
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
}
