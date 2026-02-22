// =============================================================================
// AdminQRMonitor.tsx — Fix 2: Admin QR Monitoring page
// Shows QR stats (total generated/valid/duplicate/invalid), scan log table.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import {
    LayoutDashboard, Trophy, Bell, HelpCircle, QrCode,
    ShieldCheck, ShieldAlert, Copy, BarChart3, RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    getQRStats,
    getQRScanLogs,
    processQRScan,
    getHackathons,
    type QRScanLog,
    type Hackathon
} from "@/lib/storage";
import { toast } from "@/hooks/use-toast";


function SimulatorHandler({ onLoad }: { onLoad: () => void }) {
    const [payload, setPayload] = useState("");

    const handleProcess = async () => {
        try {
            const data = JSON.parse(payload);
            const res = await processQRScan(data);
            if (res.success) {
                toast({ title: res.message });
            } else {
                toast({ title: res.message, variant: "destructive" });
            }
            setPayload("");
            onLoad();
        } catch (e) {
            toast({ title: "Invalid JSON payload", variant: "destructive" });
        }
    };

    return (
        <div className="flex flex-1 gap-2">
            <input
                type="text"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder="Paste QR Payload JSON here..."
                className="flex-1 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
                onClick={handleProcess}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
            >
                PROCESS SCAN
            </button>
        </div>
    );
}

const sidebarItems = [
    { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
    { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
    { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/admin/announcements", label: "Announcements", icon: Bell },
    { to: "/helpline", label: "Helpline", icon: HelpCircle },
];

const resultColors: Record<string, string> = {
    valid: "bg-success/10 text-success",
    invalid: "bg-destructive/10 text-destructive",
    duplicate: "bg-warning/10 text-warning",
    expired: "bg-muted text-muted-foreground",
};

export default function AdminQRMonitor() {
    const [hackathons, setHackathons] = useState<Hackathon[]>([]);
    const [selectedHackathon, setSelectedHackathon] = useState("all");
    const [stats, setStats] = useState({ totalGenerated: 0, totalScans: 0, validScans: 0, duplicateAttempts: 0, invalidScans: 0 });
    const [logs, setLogs] = useState<QRScanLog[]>([]);

    const loadData = () => {
        setHackathons(getHackathons());
        const hid = selectedHackathon === "all" ? undefined : selectedHackathon;
        setStats(getQRStats(hid));
        setLogs(getQRScanLogs(hid));
    };

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 5000); // poll for updates
        return () => clearInterval(iv);
    }, [selectedHackathon]);

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Admin" />
            <main className="flex-1 p-6 md:p-8">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="mb-1 font-display text-2xl font-bold">QR Monitoring</h1>
                            <p className="text-sm text-muted-foreground">Track QR generation and scan activity</p>
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

                    {/* Scan Simulator (Fix 6) */}
                    <div className="glass-card mb-8 p-6">
                        <div className="mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <h2 className="font-display text-lg font-semibold">Scan Simulator</h2>
                        </div>
                        <SimulatorHandler onLoad={loadData} />
                        <p className="mt-2 text-[10px] text-muted-foreground">This tool simulates a guard's QR scanner. It verifies the payload, checks progression, and locks usage.</p>
                    </div>

                    {/* Stats cards */}
                    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <QrCode className="h-4 w-4" />
                                <p className="text-xs">Total Generated</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold">{stats.totalGenerated}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <BarChart3 className="h-4 w-4" />
                                <p className="text-xs">Total Scans</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold">{stats.totalScans}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-success">
                                <ShieldCheck className="h-4 w-4" />
                                <p className="text-xs">Valid</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold text-success">{stats.validScans}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-warning">
                                <Copy className="h-4 w-4" />
                                <p className="text-xs">Duplicates</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold text-warning">{stats.duplicateAttempts}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-center gap-2 text-destructive">
                                <ShieldAlert className="h-4 w-4" />
                                <p className="text-xs">Invalid</p>
                            </div>
                            <p className="mt-2 font-display text-2xl font-bold text-destructive">{stats.invalidScans}</p>
                        </div>
                    </div>

                    {/* Scan logs table */}
                    <div className="glass-card overflow-hidden">
                        <div className="border-b border-border/50 px-6 py-4">
                            <h2 className="font-display text-lg font-semibold">Scan Logs</h2>
                            <p className="text-xs text-muted-foreground">Refreshes every 5 seconds</p>
                        </div>

                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <QrCode className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
                                <p className="text-sm">No scan logs yet.</p>
                                <p className="mt-1 text-xs">QR codes scanned at registration desks will appear here.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border/30 text-xs text-muted-foreground">
                                            <th className="px-6 py-3 text-left font-medium">Time</th>
                                            <th className="px-6 py-3 text-left font-medium">User</th>
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
                                                    <Badge className={resultColors[log.result]} variant="secondary">
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
            </main>
        </div>
    );
}
