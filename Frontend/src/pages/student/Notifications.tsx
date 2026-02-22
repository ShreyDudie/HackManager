// =============================================================================
// Notifications.tsx — Student notifications page
// Reads from shared localStorage (sq_notifications) keyed by hackathonId.
// Admin announcements automatically appear here.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Upload, Github, QrCode, Bell, UserCheck, Megaphone, HelpCircle, Linkedin } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getNotifications, findUserRegistration, type Notification } from "@/lib/storage";

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

export default function Notifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Poll for new notifications every 5 seconds (lightweight)
    useEffect(() => {
        const load = () => {
            if (!user?.email) return;
            const reg = findUserRegistration(user.email);
            // Load notifications for this user's hackathon, plus global ones
            const hackathonNotifs = reg ? getNotifications(reg.hackathonId) : [];
            const globalNotifs = getNotifications("global");
            // Combine and sort by date (newest first)
            const combined = [...hackathonNotifs, ...globalNotifs];
            // De-duplicate by ID
            const unique = combined.filter(
                (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i
            );
            setNotifications(unique);
        };

        load(); // Initial load
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div className="flex min-h-screen pt-16">
            <DashboardSidebar items={sidebarItems} title="Student" />
            <main className="flex-1 p-6 md:p-8">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h1 className="mb-1 font-display text-2xl font-bold">Notifications</h1>
                    <p className="mb-8 text-sm text-muted-foreground">
                        Announcements and updates from the admin
                    </p>

                    {notifications.length === 0 ? (
                        <div className="glass-card flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground">
                            <Bell className="h-12 w-12 text-muted-foreground/30" />
                            <p className="text-sm">No notifications yet</p>
                            <p className="text-xs">Announcements from the admin will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-w-2xl">
                            {notifications.map((n) => (
                                <motion.div
                                    key={n.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="glass-card p-5"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                            <Megaphone className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-sm font-semibold">{n.title}</h3>
                                                <span className="text-xs text-muted-foreground">{n.date}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{n.message}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
}
