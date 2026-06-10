import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import { useEffect } from "react";

// ── Intercept localStorage globally for real-time cross-browser synchronization ──
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;

localStorage.setItem = function (key, value) {
  originalSetItem.apply(this, arguments as any);
  if (key.startsWith("sq_") || key === "global_hackathons" || key === "user_registrations") {
    fetch("http://localhost:8000/api/auth/sync/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }
};

localStorage.removeItem = function (key) {
  originalRemoveItem.apply(this, arguments as any);
  if (key.startsWith("sq_") || key === "global_hackathons" || key === "user_registrations") {
    fetch("http://localhost:8000/api/auth/sync/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: null }),
    }).catch(() => {});
  }
};


// ── Page imports ──
import Index from "./pages/Index";
import RoleSelect from "./pages/RoleSelect";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/StudentDashboard";
import JudgeDashboard from "./pages/JudgeDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AddHackathon from "./pages/AddHackathon";
import HackathonDetail from "./pages/HackathonDetail";
import Leaderboard from "./pages/Leaderboard";
import Hackathons from "./pages/Hackathons";
import PPTUpload from "./pages/PPTUpload";
import Helpline from "./pages/Helpline";

// ── Student sub-pages ──
import GitHubRepo from "./pages/student/GitHubRepo";
import MyQR from "./pages/student/MyQR";
import Notifications from "./pages/student/Notifications";
import FaceVerify from "./pages/student/FaceVerify";
import GrievanceSupport from "./pages/student/GrievanceSupport";
import LinkedInPostPage from "./pages/student/LinkedInPost";

// ── Admin sub-pages ──
import AdminQRMonitor from "./pages/AdminQRMonitor";

// ── Global Components ──
import ErrorBoundary from "./components/ErrorBoundary";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const syncState = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/auth/sync/");
        if (res.ok) {
          const data = await res.json();
          Object.entries(data).forEach(([key, value]) => {
            if (key.startsWith("sq_") || key === "global_hackathons" || key === "user_registrations") {
              if (localStorage.getItem(key) !== value) {
                originalSetItem.call(localStorage, key, value as string);
                window.dispatchEvent(new Event("storage"));
              }
            }
          });
        }
      } catch {
        // Silent fail if backend is restarting
      }
    };
    syncState();

    // Poll backend every 3 seconds to keep different browsers in sync
    const iv = setInterval(syncState, 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
              <Navbar />
              <Routes>
                {/* ── Public Routes ── */}
                <Route path="/" element={<Index />} />
                <Route path="/role-select" element={<RoleSelect />} />
                <Route path="/auth/login" element={<Auth />} />
                <Route path="/auth/signup" element={<Auth />} />
                <Route path="/hackathons" element={<Hackathons />} />
                <Route path="/leaderboard" element={<Leaderboard />} />

                {/* ── Student Routes ── */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/ppt-upload"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <PPTUpload />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/github"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <GitHubRepo />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/qr"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <MyQR />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/notifications"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/verify"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <FaceVerify />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/grievance"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <GrievanceSupport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/linkedin"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <LinkedInPostPage />
                    </ProtectedRoute>
                  }
                />

                {/* ── Judge Routes ── */}
                <Route
                  path="/judge"
                  element={
                    <ProtectedRoute allowedRoles={["judge"]}>
                      <JudgeDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* ── Admin Routes ── */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/hackathon/new"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AddHackathon />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/hackathon/:id"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <HackathonDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/qr-monitor"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminQRMonitor />
                    </ProtectedRoute>
                  }
                />

                {/* ── Shared Routes ── */}
                <Route
                  path="/helpline"
                  element={
                    <ProtectedRoute allowedRoles={["student", "admin"]}>
                      <Helpline />
                    </ProtectedRoute>
                  }
                />

                {/* ── 404 ── */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />

              <Sonner />
            </div>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
