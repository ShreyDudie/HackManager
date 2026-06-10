// =============================================================================
// AdminQRMonitor.tsx — Live QR Scanner & Progression Simulator
// Powered by html5-qrcode. Automatic verification & database check-ins.
// Includes Web Audio synthesized beeps and visual success/warning overlays.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import {
    LayoutDashboard, HelpCircle, QrCode,
    ShieldCheck, ShieldAlert, Copy, BarChart3, RefreshCw,
    Camera, CameraOff, Volume2, History, CheckCircle2, AlertTriangle, XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    getQRStats,
    getQRScanLogs,
    processQRScan,
    getHackathons,
    getRegistrations,
    getQRTokens,
    addQRToken,
    sha256,
    findUserRegistration,
    updateMemberVerification,
    type QRScanLog,
    type Hackathon,
    type Registration
} from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

const sidebarItems = [
    { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
    { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
    { to: "/helpline", label: "Helpline", icon: HelpCircle },
];

const resultColors: Record<string, string> = {
    valid: "bg-success/10 text-success border-success/20",
    invalid: "bg-destructive/10 text-destructive border-destructive/20",
    duplicate: "bg-warning/10 text-warning border-warning/20",
    expired: "bg-muted text-muted-foreground border-muted/50",
};

// ── Synthesizer audio checkmarks (No static file dependencies) ──
function playScanSound(type: "valid" | "duplicate" | "invalid" | "expired") {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "valid") {
            // High pitch positive chirp
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === "duplicate") {
            // Flat warning tone
            osc.type = "triangle";
            osc.frequency.setValueAtTime(330, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else {
            // Double low buzzer
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        }
    } catch (e) {
        console.warn("Audio Context failed", e);
    }
}

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

export default function AdminQRMonitor() {
    const [hackathons, setHackathons] = useState<Hackathon[]>([]);
    const [selectedHackathon, setSelectedHackathon] = useState("all");
    const [stats, setStats] = useState({ totalGenerated: 0, totalScans: 0, validScans: 0, duplicateAttempts: 0, invalidScans: 0 });
    const [logs, setLogs] = useState<QRScanLog[]>([]);

    // Scanner state
    const [cameraActive, setCameraActive] = useState(false);
    const [scannerError, setScannerError] = useState("");
    const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
    const lastScannedRef = useRef<{ text: string; time: number } | null>(null);

    // Overlay scan result state (Premium Visual Feedback)
    const [scanOverlay, setScanOverlay] = useState<{
        result: "valid" | "duplicate" | "invalid" | "expired";
        title: string;
        message: string;
        userEmail?: string;
    } | null>(null);

    // Face verification states
    const [faceVerifyEmail, setFaceVerifyEmail] = useState<string | null>(null);
    const [faceCameraError, setFaceCameraError] = useState("");
    const [faceCapturedImage, setFaceCapturedImage] = useState<string | null>(null);
    const [faceSimilarity, setFaceSimilarity] = useState<number | null>(null);
    const [faceVerifying, setFaceVerifying] = useState(false);
    const faceVideoRef = useRef<HTMLVideoElement>(null);
    const faceStreamRef = useRef<MediaStream | null>(null);

    // Simulator form state
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [simRegId, setSimRegId] = useState("");
    const [simType, setSimType] = useState<"registration" | "breakfast" | "lunch" | "dinner">("registration");
    const [simDay, setSimDay] = useState("1");
    const [simulating, setSimulating] = useState(false);

    const loadData = () => {
        setHackathons(getHackathons());
        const hid = selectedHackathon === "all" ? undefined : selectedHackathon;
        setStats(getQRStats(hid));
        setLogs(getQRScanLogs(hid));
        
        // Load eligible teams for simulator
        setRegistrations(getRegistrations(hid));
    };

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 5000);
        return () => clearInterval(iv);
    }, [selectedHackathon]);

    // Handle scanner cleanup
    useEffect(() => {
        return () => {
            if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
                html5QrcodeRef.current.stop().catch(console.error);
            }
        };
    }, []);

    // Start Webcam QR scan
    const startScanner = async () => {
        setScannerError("");
        setCameraActive(true);
        try {
            // Ensure reader container is mounted
            setTimeout(async () => {
                try {
                    const html5Qrcode = new Html5Qrcode("reader");
                    html5QrcodeRef.current = html5Qrcode;
                    await html5Qrcode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 220, height: 220 }
                        },
                        async (decodedText) => {
                            const now = Date.now();
                            // Throttler: prevent scanning same code repeatedly within 4 seconds
                            if (lastScannedRef.current?.text === decodedText && now - lastScannedRef.current.time < 4000) {
                                return;
                            }
                            lastScannedRef.current = { text: decodedText, time: now };

                            try {
                                const payload = JSON.parse(decodedText);
                                triggerScanProcess(payload);
                            } catch {
                                handleScanResult("invalid", "Format Error", "The scanned QR code is not a valid HackManager token.");
                            }
                        },
                        () => {} // silent frame failures
                    );
                } catch (err: any) {
                    setScannerError(err.message || "Failed to initialize webcam scanner.");
                    setCameraActive(false);
                }
            }, 100);
        } catch (e: any) {
            setScannerError(e.message || "Camera permission issue.");
            setCameraActive(false);
        }
    };

    // Stop Webcam QR scan
    const stopScanner = async () => {
        if (html5QrcodeRef.current) {
            try {
                if (html5QrcodeRef.current.isScanning) {
                    await html5QrcodeRef.current.stop();
                }
            } catch (e) {
                console.error(e);
            }
            html5QrcodeRef.current = null;
        }
        setCameraActive(false);
    };

    // Face verification handlers
    const openFaceVerification = async (email: string) => {
        setFaceCameraError("");
        setFaceCapturedImage(null);
        setFaceSimilarity(null);
        setFaceVerifyEmail(email);
        setScanOverlay(null); // Close QR overlay immediately

        // Stop QR scanner if scanning
        if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
            await html5QrcodeRef.current.stop().catch(console.error);
            setCameraActive(false);
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            faceStreamRef.current = stream;
            setTimeout(() => {
                if (faceVideoRef.current) faceVideoRef.current.srcObject = stream;
            }, 100);
        } catch {
            setFaceCameraError("Camera access denied");
        }
    };

    const closeFaceVerification = () => {
        if (faceStreamRef.current) {
            faceStreamRef.current.getTracks().forEach((t) => t.stop());
            faceStreamRef.current = null;
        }
        setFaceVerifyEmail(null);
        setFaceCapturedImage(null);
        setFaceSimilarity(null);
        setFaceCameraError("");
    };

    const captureAndCompareFace = async () => {
        if (!faceVideoRef.current || !faceVerifyEmail) return;
        setFaceVerifying(true);

        const canvas = document.createElement("canvas");
        canvas.width = faceVideoRef.current.videoWidth || 300;
        canvas.height = faceVideoRef.current.videoHeight || 300;
        canvas.getContext("2d")!.drawImage(faceVideoRef.current, 0, 0);
        const captured = canvas.toDataURL("image/jpeg", 0.7);
        setFaceCapturedImage(captured);

        try {
            const blob = await (await fetch(captured)).blob();
            const file = new File([blob], "verify.jpg", { type: "image/jpeg" });

            const formData = new FormData();
            formData.append("file", file);

            const emailParam = `?email=${encodeURIComponent(faceVerifyEmail)}`;
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
                setFaceSimilarity(simPct);
                
                // Update local storage database verification status
                const reg = findUserRegistration(faceVerifyEmail);
                if (reg) {
                    const idx = reg.members.findIndex(m => m.email === faceVerifyEmail);
                    if (idx !== -1) {
                        updateMemberVerification(reg.id, idx, true, captured);
                    }
                }
                
                toast({ title: `Verified! Similarity: ${simPct}%`, description: "Identity verified successfully." });
            } else {
                const simPct = Math.round((data.similarity || 0) * 100);
                setFaceSimilarity(simPct);
                toast({
                    title: "Verification Failed",
                    description: data.message || `Face mismatch (Similarity: ${simPct}%).`,
                    variant: "destructive",
                });
            }
        } catch (err: any) {
            toast({
                title: "Server Verification Offline",
                description: "Using local fallback comparison.",
                variant: "destructive",
            });

            const storedFace = localStorage.getItem(`face_${faceVerifyEmail}`);
            if (!storedFace) {
                const reg = findUserRegistration(faceVerifyEmail);
                if (reg?.faceImage) {
                    const sim = await compareImages(reg.faceImage, captured);
                    setFaceSimilarity(sim);
                    if (sim >= 70) {
                        const idx = reg.members.findIndex(m => m.email === faceVerifyEmail);
                        if (idx !== -1) {
                            updateMemberVerification(reg.id, idx, true, captured);
                        }
                        toast({ title: `Verified! Similarity: ${sim}%`, description: "Identity verified." });
                    } else {
                        toast({ title: `Verification Failed (Local): ${sim}%`, variant: "destructive" });
                    }
                } else {
                    toast({ title: "No reference face found to verify." });
                }
            } else {
                const sim = await compareImages(storedFace, captured);
                setFaceSimilarity(sim);
                if (sim >= 70) {
                    const reg = findUserRegistration(faceVerifyEmail);
                    if (reg) {
                        const idx = reg.members.findIndex(m => m.email === faceVerifyEmail);
                        if (idx !== -1) {
                            updateMemberVerification(reg.id, idx, true, captured);
                        }
                    }
                    toast({ title: `Verified! Similarity: ${sim}%` });
                } else {
                    toast({ title: `Verification Failed (Local): ${sim}%`, variant: "destructive" });
                }
            }
        } finally {
            setFaceVerifying(false);
        }
    };

    // Shared execution route
    const triggerScanProcess = async (payload: any) => {
        try {
            const res = await processQRScan(payload);
            const userEmail = payload.userId || payload.userEmail || "";
            handleScanResult(res.result, res.success ? "Success" : "Denied", res.message, userEmail);
        } catch (err: any) {
            handleScanResult("invalid", "Scan Error", err.message || "System error during validation.");
        }
    };

    const handleScanResult = (
        result: QRScanLog["result"],
        title: string,
        message: string,
        userEmail?: string
    ) => {
        playScanSound(result);
        setScanOverlay({ result, title, message, userEmail });
        loadData();

        // Clear overlay after 6 seconds if not manually closed
        setTimeout(() => {
            setScanOverlay((prev) => {
                // Keep if verification has been triggered
                if (prev?.userEmail && faceVerifyEmail) return prev;
                return null;
            });
        }, 6000);
    };

    // Automated simulator action
    const handleSimulateScan = async () => {
        if (!simRegId) {
            toast({ title: "Select Team", description: "Choose a team to simulate scanning.", variant: "destructive" });
            return;
        }
        const reg = registrations.find(r => r.id === simRegId);
        if (!reg) return;

        setSimulating(true);

        try {
            if (simType === "registration") {
                // Generate rotating signed signature
                const timePeriod = Math.floor(Date.now() / 60000);
                const raw = `${reg.teamName}|${reg.userEmail}|${reg.hackathonId}|${timePeriod}`;
                const hash = await sha256(raw);

                const payload = {
                    hackathonId: reg.hackathonId,
                    userId: reg.userEmail,
                    teamName: reg.teamName,
                    type: "registration",
                    timestamp: timePeriod,
                    hash: hash.slice(0, 16)
                };
                await triggerScanProcess(payload);
            } else {
                // Meal Token - Progression check
                const dayInt = parseInt(simDay);
                let userTokens = getQRTokens(reg.userEmail, reg.hackathonId);
                let matchedToken = userTokens.find(t => t.type === simType && t.day === dayInt);

                // Auto-generate tokens if student hasn't done it yet (simulating self-service generation)
                if (!matchedToken) {
                    for (const mType of ["breakfast", "lunch", "dinner"]) {
                        const hash = await sha256(`meal|${reg.userEmail}|${reg.hackathonId}|${mType}|day${dayInt}|${Date.now()}`);
                        addQRToken({
                            id: crypto.randomUUID().slice(0, 8),
                            hackathonId: reg.hackathonId,
                            userEmail: reg.userEmail,
                            type: mType as any,
                            day: dayInt,
                            token: hash,
                            used: false,
                            createdAt: new Date().toISOString()
                        });
                    }
                    userTokens = getQRTokens(reg.userEmail, reg.hackathonId);
                    matchedToken = userTokens.find(t => t.type === simType && t.day === dayInt);
                }

                const payload = {
                    hackathonId: reg.hackathonId,
                    userEmail: reg.userEmail,
                    type: simType,
                    day: dayInt,
                    token: matchedToken?.token || "mock_invalid_token",
                    hash: (matchedToken?.token || "mock_invalid_token").slice(0, 16)
                };
                await triggerScanProcess(payload);
            }
        } catch (err: any) {
            toast({ title: "Simulation Failed", description: err.message, variant: "destructive" });
        } finally {
            setSimulating(false);
        }
    };

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Admin" />
            <main className="flex-1 p-6 md:p-8 relative">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="mb-1 font-display text-2xl font-bold">Automatic check-in & Food QR</h1>
                            <p className="text-sm text-muted-foreground">Scan dynamic rotating barcodes and track meal redemption logs</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={selectedHackathon} onValueChange={setSelectedHackathon}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Filter by hackathon" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Hackathons</SelectItem>
                                    {hackathons.map((h) => (
                                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <button onClick={loadData} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground">
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Scanner and Simulator grid */}
                    <div className="mb-8 grid gap-6 md:grid-cols-2">
                        {/* CAMERA QR SCANNER */}
                        <div className="glass-card p-6 flex flex-col justify-between">
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Camera className="h-5 w-5 text-primary" />
                                        <h2 className="font-display text-lg font-semibold">Webcam Scanner</h2>
                                    </div>
                                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <Volume2 className="h-3 w-3" /> Audio Beeps Active
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">Point your camera at a participant's rotating check-in QR or static meal pass. Verification is instantaneous.</p>

                                {cameraActive ? (
                                    <div className="relative mx-auto w-64 h-64 overflow-hidden rounded-2xl border border-primary/20 bg-black">
                                        <div id="reader" className="w-full h-full"></div>
                                        <div className="absolute inset-0 pointer-events-none border-2 border-primary/40 rounded-2xl animate-pulse"></div>
                                    </div>
                                ) : (
                                    <div className="mx-auto w-64 h-64 flex flex-col items-center justify-center rounded-2xl bg-secondary/30 border-2 border-dashed border-border text-muted-foreground">
                                        <CameraOff className="h-10 w-10 mb-2 opacity-50" />
                                        <p className="text-xs">Scanner is offline</p>
                                    </div>
                                )}
                                {scannerError && <p className="text-xs text-destructive mt-2 text-center font-medium">{scannerError}</p>}
                            </div>

                            <div className="mt-6">
                                {cameraActive ? (
                                    <button onClick={stopScanner} className="w-full rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground shadow hover:bg-destructive/90 transition-colors">
                                        STOP SCANNER
                                    </button>
                                ) : (
                                    <button onClick={startScanner} className="w-full btn-primary-glow py-2.5 text-sm font-bold">
                                        START CAMERA SCANNER
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* PROGRESSION SIMULATOR */}
                        <div className="glass-card p-6 flex flex-col justify-between">
                            <div>
                                <div className="mb-4 flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                    <h2 className="font-display text-lg font-semibold">Progression Simulator</h2>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">Demonstrate the check-in lifecycle (Registration check-in &rarr; Breakfast &rarr; Lunch &rarr; Dinner) directly from the dashboard.</p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Team / Student</label>
                                        <Select value={simRegId} onValueChange={setSimRegId}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Select team..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {registrations.length === 0 ? (
                                                    <SelectItem value="none" disabled>No registered teams</SelectItem>
                                                ) : (
                                                    registrations.map(r => (
                                                        <SelectItem key={r.id} value={r.id}>
                                                            {r.teamName} ({r.userEmail}) {r.qrTokenUsed ? "✓ In" : "✗ Out"}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Check-in Type</label>
                                            <Select value={simType} onValueChange={(v: any) => setSimType(v)}>
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="registration">🎫 Entry Registration</SelectItem>
                                                    <SelectItem value="breakfast">🌅 Breakfast</SelectItem>
                                                    <SelectItem value="lunch">☀️ Lunch</SelectItem>
                                                    <SelectItem value="dinner">🌙 Dinner</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {simType !== "registration" && (
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Day</label>
                                                <Select value={simDay} onValueChange={setSimDay}>
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1">Day 1</SelectItem>
                                                        <SelectItem value="2">Day 2</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSimulateScan}
                                disabled={simulating || !simRegId}
                                className="mt-6 w-full rounded-lg border border-primary/30 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors"
                            >
                                {simulating ? "SIMULATING..." : "SIMULATE DISPATCH"}
                            </button>
                        </div>
                    </div>

                    {/* Stats cards */}
                    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <QrCode className="h-4 w-4" />
                                <p className="text-xs">Generated Tokens</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold">{stats.totalGenerated}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <History className="h-4 w-4" />
                                <p className="text-xs">Total Scan Events</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold">{stats.totalScans}</p>
                        </div>
                        <div className="glass-card p-5 border-success/20">
                            <div className="flex items-center gap-2 text-success">
                                <CheckCircle2 className="h-4 w-4" />
                                <p className="text-xs">Valid Entries</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold text-success">{stats.validScans}</p>
                        </div>
                        <div className="glass-card p-5 border-warning/20">
                            <div className="flex items-center gap-2 text-warning">
                                <AlertTriangle className="h-4 w-4" />
                                <p className="text-xs">Duplicate Rejections</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold text-warning">{stats.duplicateAttempts}</p>
                        </div>
                        <div className="glass-card p-5 border-destructive/20">
                            <div className="flex items-center gap-2 text-destructive">
                                <XCircle className="h-4 w-4" />
                                <p className="text-xs">Invalid / Expired</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold text-destructive">{stats.invalidScans}</p>
                        </div>
                    </div>

                    {/* Scan logs table */}
                    <div className="glass-card overflow-hidden">
                        <div className="border-b border-border/50 px-6 py-4">
                            <h2 className="font-display text-lg font-semibold">Scan Activity Feed</h2>
                            <p className="text-[10px] text-muted-foreground">Live feed updates automatically</p>
                        </div>

                        {logs.length === 0 ? (
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
                                            <th className="px-6 py-3 text-left font-medium">User Email</th>
                                            <th className="px-6 py-3 text-left font-medium">Team</th>
                                            <th className="px-6 py-3 text-left font-medium">Type</th>
                                            <th className="px-6 py-3 text-left font-medium">Token Hash</th>
                                            <th className="px-6 py-3 text-left font-medium">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {logs.map((log) => (
                                            <tr key={log.id} className="text-sm">
                                                <td className="whitespace-nowrap px-6 py-3 text-xs text-muted-foreground">
                                                    {new Date(log.scannedAt).toLocaleString("en-US", {
                                                        month: "short", day: "numeric",
                                                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                                                    })}
                                                </td>
                                                <td className="px-6 py-3">{log.userEmail}</td>
                                                <td className="px-6 py-3 font-medium">{log.teamName}</td>
                                                <td className="px-6 py-3">
                                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{log.tokenType}</span>
                                                </td>
                                                <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{log.tokenHash}</td>
                                                <td className="px-6 py-3">
                                                    <Badge className={`${resultColors[log.result]} border`} variant="secondary">
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
                </motion.div>

                {/* PREMIUM FULL-SCREEN OVERLAY FOR LIVE SCAN RESULTS */}
                <AnimatePresence>
                    {scanOverlay && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="text-center p-8 max-w-sm space-y-4"
                            >
                                <div className="flex justify-center">
                                    {scanOverlay.result === "valid" ? (
                                        <div className="rounded-full bg-success/20 p-4 animate-bounce">
                                            <CheckCircle2 className="h-16 w-16 text-success" />
                                        </div>
                                    ) : scanOverlay.result === "duplicate" ? (
                                        <div className="rounded-full bg-warning/20 p-4 animate-pulse">
                                            <AlertTriangle className="h-16 w-16 text-warning" />
                                        </div>
                                    ) : (
                                        <div className="rounded-full bg-destructive/20 p-4 animate-shake">
                                            <XCircle className="h-16 w-16 text-destructive" />
                                        </div>
                                    )}
                                </div>
                                <h2 className="font-display text-2xl font-bold tracking-tight">
                                    {scanOverlay.title}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {scanOverlay.message}
                                </p>
                                <Badge className={`${resultColors[scanOverlay.result]} border px-3 py-1 text-sm uppercase`} variant="secondary">
                                    {scanOverlay.result}
                                </Badge>

                                {scanOverlay.result === "valid" && scanOverlay.userEmail && (
                                    <div className="pt-4 flex flex-col gap-2 w-full">
                                        <button
                                            onClick={() => openFaceVerification(scanOverlay.userEmail!)}
                                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                                        >
                                            <Camera className="h-4 w-4" /> Verify Face Identity
                                        </button>
                                        <button
                                            onClick={() => setScanOverlay(null)}
                                            className="w-full rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Face Verification Modal ── */}
                {faceVerifyEmail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <div className="glass-card mx-4 w-full max-w-sm p-6">
                            <h2 className="mb-4 font-display text-lg font-semibold text-center">Face Identity Verification</h2>
                            {faceCameraError ? (
                                <div className="space-y-4 text-center">
                                    <p className="text-sm text-destructive">{faceCameraError}</p>
                                    <button
                                        className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                                        onClick={closeFaceVerification}
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-border">
                                        {!faceCapturedImage ? (
                                            <video ref={faceVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={faceCapturedImage} className="w-full h-full object-cover" alt="Captured" />
                                        )}
                                    </div>
                                    
                                    {faceSimilarity !== null && (
                                        <div className={`rounded-lg p-3 text-center text-sm font-semibold ${faceSimilarity >= 70 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                                            Similarity: {faceSimilarity}% {faceSimilarity >= 70 ? "✓ Verified Match" : "✗ Face Mismatch"}
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-2">
                                        <button
                                            className="flex-1 gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/95 flex items-center justify-center disabled:opacity-50 transition-colors"
                                            onClick={captureAndCompareFace}
                                            disabled={faceVerifying}
                                        >
                                            {faceVerifying ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : <Camera className="h-4 w-4 mr-1.5" />}
                                            {faceSimilarity !== null ? "Retry Capture" : "Capture & Verify"}
                                        </button>
                                        <button
                                            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                            onClick={closeFaceVerification}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground text-center truncate">
                                        Verifying identity for: {faceVerifyEmail}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
