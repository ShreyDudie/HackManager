import { useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// ── Fix 1: Validation helpers ──
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\d{10}$/;

export default function Auth() {
  const location = useLocation();
  const isSignup = location.pathname.includes("signup");
  const [searchParams] = useSearchParams();
  const role = (searchParams.get("role") || "student") as UserRole;
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Real-time validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const getFieldError = (field: string): string => {
    if (!touched[field]) return "";
    switch (field) {
      case "name": return !name.trim() ? "Name is required" : "";
      case "email": return !email.trim() ? "Email is required" : !EMAIL_REGEX.test(email) ? "Invalid email format" : "";
      case "phone": return phone.trim() && !PHONE_REGEX.test(phone) ? "Must be exactly 10 digits" : "";
      case "password":
        if (!password) return "Password is required";
        if (password.length < 6) return "Must be at least 6 characters";
        return "";
      default: return "";
    }
  };

  const dashboardPath = role === "admin" ? "/admin" : role === "judge" ? "/judge" : "/student";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Frontend validation
    if (isSignup) {
      if (!name.trim()) { setError("Name is required"); setLoading(false); return; }
      if (!EMAIL_REGEX.test(email)) { setError("Invalid email format"); setLoading(false); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
      if (phone.trim() && !PHONE_REGEX.test(phone)) { setError("Phone must be 10 digits"); setLoading(false); return; }
    }

    try {
      if (isSignup) {
        await signup({ email: email.trim(), password, name: name.trim(), role, phone_number: phone.trim() || undefined });
      } else {
        await login(email.trim(), password, role);
      }
      navigate(dashboardPath);
    } catch (err: any) {
      // Parse structured error messages from backend
      try {
        const parsed = JSON.parse(err.message);
        const msgs = Object.values(parsed).flat().join(". ");
        setError(msgs);
      } catch {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card mx-4 w-full max-w-md p-8"
      >
        <h1 className="mb-1 font-display text-2xl font-bold">
          {isSignup ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isSignup ? "Sign up" : "Log in"} as <span className="font-medium capitalize text-primary">{role}</span>
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="John Doe"
              />
              {getFieldError("name") && <p className="mt-1 text-xs text-destructive">{getFieldError("name")}</p>}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@example.com"
            />
            {getFieldError("email") && <p className="mt-1 text-xs text-destructive">{getFieldError("email")}</p>}
          </div>
          {/* Fix 1: Phone number field (signup only) */}
          {isSignup && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="9876543210"
              />
              {getFieldError("phone") && <p className="mt-1 text-xs text-destructive">{getFieldError("phone")}</p>}
              {phone && PHONE_REGEX.test(phone) && <p className="mt-1 text-xs text-success">✓ Valid phone number</p>}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {getFieldError("password") && <p className="mt-1 text-xs text-destructive">{getFieldError("password")}</p>}
            {isSignup && password.length >= 6 && <p className="mt-1 text-xs text-success">✓ Strong enough</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary-glow flex w-full items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignup ? "Sign Up" : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <a
            href={isSignup ? `/auth/login?role=${role}` : `/auth/signup?role=${role}`}
            className="font-medium text-primary hover:underline"
          >
            {isSignup ? "Login" : "Sign Up"}
          </a>
        </p>
      </motion.div>
    </div>
  );
}
