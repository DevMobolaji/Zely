import { authService } from "@/services/auth.services";
import { AlertCircle, Loader2, Lock, Mail, Unlock } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import AuthLayout from "../../layouts/AuthLayout";

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setAuthFromUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validateEmail = (value: string) => {
    if (!value) return "Email is required";
    if (!/\S+@\S+\.\S+/.test(value))
      return "Please enter a valid email address";
    return undefined;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (errors.email) {
      setErrors((prev: any) => ({ ...prev, email: validateEmail(val) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      try {
        const response = await authService.login(email, password);
        const { user } = response;

        // Check if email is verified — backend returns emailVerified on the user
        if (!user.emailVerified) {
          localStorage.setItem("pendingEmail", email);
          showToast("error", "Please verify your email before logging in.");
          navigate("/verify", { state: { email } });
          return;
        }

        // Store tokens and set auth state
        setAuthFromUser(user);

        showToast("success", `Welcome back, ${user.name}`);

        const nextTarget = user.role === "admin" ? "/admin" : "/dashboard";
        navigate(nextTarget);
      } catch (error: any) {
        const msg =
          error.response?.data?.message ||
          "Login failed. Please check your credentials.";
        showToast("error", msg);
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      const msg =
        error.response?.data?.message ||
        "Connection failed. Please check your credentials.";
      showToast("error", msg);
    } finally {
      setIsLoading(false);
    }
  };
  const handleGoogleLogin = async () => {
    showToast("error", "Google login is not available yet.");
  };

  const RightSectionContent = (
    <>
      <div className="relative w-full h-[400px] mb-8 flex items-center justify-center perspective-[1000px]">
        <div className="absolute w-80 h-96 glassmorphism rounded-[2rem] border-t border-l border-white/20 shadow-2xl flex flex-col items-center justify-between py-10 z-20 animate-float overflow-hidden group">
          <div className="w-full px-8 flex justify-between items-center">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
              Secure_Shell
            </span>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-violet-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(124,58,237,0.5)] z-10">
              <svg
                width="96"
                height="96"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-bold text-green-400 tracking-wide">
                ENCRYPTED
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4 text-center sm:text-left">
        <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tighter leading-tight">
          Uncompromised Security.
        </h2>
        <p className="text-lg text-gray-400 font-medium max-w-md leading-relaxed">
          Your data is protected with enterprise-grade encryption.
        </p>
      </div>
    </>
  );

  return (
    <AuthLayout rightSection={RightSectionContent}>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
        Welcome Back
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
        Securely login to manage your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2"
            htmlFor="email"
          >
            Email Address
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail
                className={`w-5 h-5 transition-colors duration-300 ${errors.email ? "text-red-400" : "text-slate-400 group-focus-within:text-primary"}`}
              />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.email ? "border-red-500 focus:ring-red-500/10" : "border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"}`}
              required
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3 h-3" />
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              className="block text-sm font-semibold text-slate-600 dark:text-slate-300"
              htmlFor="password"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => navigate("/reset-password")}
              className="text-sm font-semibold text-primary hover:text-primary-light transition-colors"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock
                className={`w-5 h-5 transition-colors duration-300 ${errors.password ? "text-red-400" : "text-slate-400 group-focus-within:text-primary"}`}
              />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-12 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.password ? "border-red-500 focus:ring-red-500/10" : "border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary"}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? (
                <Unlock className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl text-base font-bold text-white bg-slate-900 dark:bg-primary hover:opacity-90 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 !mt-8"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log In"}
        </button>
      </form>

      <div className="relative flex items-center my-8">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
          Or continue with
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm mb-6"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span>Google</span>
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400 font-medium">
        Don't have an account?{" "}
        <button
          onClick={() => navigate("/register")}
          className="font-bold text-primary hover:underline"
        >
          Sign Up
        </button>
      </p>
    </AuthLayout>
  );
};

export default LoginScreen;
