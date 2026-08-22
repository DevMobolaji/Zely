import { Loader2 } from "lucide-react";
import React, { createContext, useContext, useEffect, useState } from "react";
import { authService, AuthUser } from "../services/auth.services";
import { clearTokens, setAccessToken } from "../utils/api";

interface AuthState {
  accessToken: string | null;
  user: {
    userId: string;
    name: string;
    email: string;
    emailVerified: boolean;
    role: string;
  } | null;
}

interface AuthContextType {
  auth: AuthState;
  setAuth: React.Dispatch<React.SetStateAction<AuthState>>;
  setAuthFromUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    user: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // ─── Helper: populate auth state from a user object ──────────────────────
  // Called after login, verify, and session restore
  const setAuthFromUser = (user: AuthUser) => {
    setAccessToken(user.accessToken ?? null);
    localStorage.setItem("userRole", user.role);
    localStorage.setItem("userName", user.name);

    setAuth({
      accessToken: user.accessToken ?? null,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    });
  };

  useEffect(() => {
    const restoreSession = async () => {
      // No more localStorage check — just try refreshing using the cookie.
      // If there's no valid cookie, the backend will return 401 and we
      // fall through to the catch block below.
      try {
        const user = await authService.refreshToken();
        setAuthFromUser(user);
      } catch (error) {
        console.warn("Session restore failed — clearing tokens");
        clearTokens();
        setAuth({ accessToken: null, user: null });
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ─── Logout
  const logout = async () => {
    await authService.logout();
    // authService.logout() calls clearTokens() and redirects
    // This line is a safety net in case redirect doesn't fire
    setAuth({ accessToken: null, user: null });
  };

  return (
    <AuthContext.Provider
      value={{ auth, setAuth, setAuthFromUser, logout, isLoading }}
    >
      {isLoading ? (
        <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-black">
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-slate-500">
              Restoring secure session...
            </p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
