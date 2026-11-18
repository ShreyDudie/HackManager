import { lazy } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
const Index = lazy(() => import("@/pages/Index"));
import Auth from "@/pages/Auth";
import RoleSelect from "@/pages/RoleSelect";
import NotFound from "@/pages/NotFound";
const EventsPage = lazy(() => import("@/pages/events/EventsPage"));
const CreateEvent = lazy(() => import("@/pages/events/CreateEvent"));
const EventWorkspace = lazy(() => import("@/pages/events/EventWorkspace"));
const JudgeWorkspace = lazy(() => import("@/pages/events/JudgeWorkspace"));
const FaceProfile = lazy(() => import("@/pages/events/FaceProfile"));

function PendingFeature() {
  return <main className="container max-w-2xl px-4 pt-28"><h1 className="text-3xl font-bold">LinkedIn post generation is unavailable</h1><Link className="text-primary underline" to="/hackathons">Go to events</Link></main>;
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
    <Route path="/judge" element={<ProtectedRoute allowedRoles={["judge"]}><JudgeWorkspace /></ProtectedRoute>} />
    <Route path="/student/verify" element={<ProtectedRoute allowedRoles={["student"]}><FaceProfile /></ProtectedRoute>} />
    {['/student/ppt-upload', '/student/github', '/student/qr', '/admin/qr-monitor'].map((path) => <Route key={path} path={path} element={<Navigate to="/hackathons" replace />} />)}
    {['/leaderboard', '/helpline', '/student/notifications', '/student/grievance'].map((path) => <Route key={path} path={path} element={<EventsPage />} />)}
    <Route path="/student/linkedin" element={<PendingFeature />} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
