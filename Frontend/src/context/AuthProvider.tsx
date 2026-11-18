import { useEffect, useState, type ReactNode } from "react";
import { AuthContext, type User, type UserRole } from "@/context/AuthContext";
import { apiRequest, ApiError } from "@/services/apiClient";
import { useQueryClient } from "@tanstack/react-query";

const API = "/api/auth";
type Account = { id: string; email: string; username: string; role: UserRole };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem("auth_token"));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const restoredToken = localStorage.getItem("auth_token");
    if (!restoredToken) return;
    let active = true;
    const current = () => active && localStorage.getItem("auth_token") === restoredToken;
    apiRequest<Account>(`${API}/me`).then((account) => {
      if (current()) setUser({ ...account, name: account.username });
    }).catch((error: unknown) => {
      if (current() && error instanceof ApiError && error.status === 401) {
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
