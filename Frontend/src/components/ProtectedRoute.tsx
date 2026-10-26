import { Navigate } from "react-router-dom";
import { useAuth, UserRole } from "@/context/AuthContext";

interface Props {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <p role="status" className="p-8 pt-24">Checking your session…</p>;

  if (!isAuthenticated) return <Navigate to="/role-select" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role))
    return <Navigate to="/" replace />;

  return <>{children}</>;
}
