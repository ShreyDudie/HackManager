import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiRequest, ApiError, USE_EXPRESS } from "@/services/apiClient";
import { useQueryClient } from "@tanstack/react-query";

export type UserRole = "student" | "judge" | "admin";

interface User {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (data: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    phone_number?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API = "/api/auth";
type Account = { id: string; email: string; username: string; role: UserRole };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(USE_EXPRESS && !!localStorage.getItem("auth_token"));
  const [user, setUser] = useState<User | null>(() => {
    if (USE_EXPRESS) return null;
    const savedUser = localStorage.getItem("user");
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });

  useEffect(() => {
    if (!USE_EXPRESS || !localStorage.getItem("auth_token")) return;
    let active = true;
    apiRequest<Account>(`${API}/me`).then((account) => {
      if (active) setUser({ ...account, name: account.username });
    }).catch((error: unknown) => {
      if (active && error instanceof ApiError && error.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
      }
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  // 🔐 LOGIN
  const login = async (email: string, password: string, role: UserRole) => {
    const data = await apiRequest<Account & { access: string }>(`${API}/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, role }),
    });

    const loggedInUser: User = {
      id: data.id,
      email: data.email,
      name: data.username || data.email.split("@")[0],
      role: data.role,
    };

    localStorage.setItem("user", JSON.stringify(loggedInUser));
    localStorage.setItem("auth_token", data.access);

    queryClient.clear();
    setUser(loggedInUser);
  };

  // 📝 SIGNUP
  const signup = async ({
    email,
    password,
    name,
    role,
    phone_number,
  }: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    phone_number?: string;
  }) => {
    await apiRequest(`${API}/signup/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        role,
        username: name,
        ...(phone_number ? { phone_number } : {}),
      }),
    });

    // Auto login after signup
    await login(email, password, role);
  };

  const logout = () => {
    queryClient.clear();
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
