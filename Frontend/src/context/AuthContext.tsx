import { createContext, useContext, useState, ReactNode } from "react";

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

const API = "http://127.0.0.1:8000/api/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // 🔐 LOGIN
  const login = async (email: string, password: string, role: UserRole) => {
    const res = await fetch(`${API}/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    const loggedInUser: User = {
      email: data.email,
      name: data.email.split("@")[0],
      role: data.role,
    };

    localStorage.setItem("user", JSON.stringify(loggedInUser));
    localStorage.setItem("auth_token", data.access);

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
    const res = await fetch(`${API}/signup/`, {
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

    const data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    // Auto login after signup
    await login(email, password, role);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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