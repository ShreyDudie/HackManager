import {
  Bell,
  Github,
  HelpCircle,
  LayoutDashboard,
  Linkedin,
  QrCode,
  Upload,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DashboardRole = "Student" | "Judge" | "Admin";
export type NavigationItem = { to: string; label: string; icon: LucideIcon };

export const dashboardNavigation: Record<DashboardRole, NavigationItem[]> = {
  Student: [
    { to: "/student", label: "Overview", icon: LayoutDashboard },
    { to: "/student/ppt-upload", label: "PPT Upload", icon: Upload },
    { to: "/student/github", label: "GitHub Repo", icon: Github },
    { to: "/student/qr", label: "My QR Code", icon: QrCode },
    { to: "/student/notifications", label: "Notifications", icon: Bell },
    { to: "/student/verify", label: "Face Verify", icon: UserCheck },
    { to: "/student/grievance", label: "Grievance & Support", icon: HelpCircle },
    { to: "/student/linkedin", label: "LinkedIn Post", icon: Linkedin },
  ],
  Judge: [{ to: "/judge", label: "Overview", icon: LayoutDashboard }],
  Admin: [
    { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
    { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
    { to: "/helpline", label: "Helpline", icon: HelpCircle },
  ],
};
