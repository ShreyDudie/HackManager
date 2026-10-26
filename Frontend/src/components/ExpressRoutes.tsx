import { Link, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import RoleSelect from "@/pages/RoleSelect";
import NotFound from "@/pages/NotFound";
import EventsPage from "@/pages/events/EventsPage";
import CreateEvent from "@/pages/events/CreateEvent";
import EventWorkspace from "@/pages/events/EventWorkspace";

function PendingFeature() {
  return <main className="container max-w-2xl px-4 pt-28"><div className="glass-card p-8"><h1 className="mb-4 text-3xl font-bold">This workspace is being updated.</h1><p className="mb-6 text-muted-foreground">Judging, results, announcements, support, and face verification are not available in this version yet. You can manage teams, submissions, and check-in from an event.</p><Link className="text-primary underline" to="/hackathons">Go to events</Link></div></main>;
}

export default function ExpressRoutes() {
  return <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/role-select" element={<RoleSelect />} />
    <Route path="/auth/login" element={<Auth />} />
    <Route path="/auth/signup" element={<Auth />} />
    <Route path="/hackathons" element={<EventsPage />} />
    <Route path="/events/:id" element={<EventWorkspace />} />
    <Route path="/student" element={<ProtectedRoute allowedRoles={["student"]}><EventsPage /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><EventsPage /></ProtectedRoute>} />
    <Route path="/admin/hackathon/new" element={<ProtectedRoute allowedRoles={["admin"]}><CreateEvent /></ProtectedRoute>} />
    <Route path="/judge" element={<ProtectedRoute allowedRoles={["judge"]}><PendingFeature /></ProtectedRoute>} />
    {['/student/ppt-upload', '/student/github', '/student/qr', '/admin/qr-monitor'].map((path) => <Route key={path} path={path} element={<Navigate to="/hackathons" replace />} />)}
    {['/leaderboard', '/helpline', '/student/notifications', '/student/verify', '/student/grievance', '/student/linkedin'].map((path) => <Route key={path} path={path} element={<PendingFeature />} />)}
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
