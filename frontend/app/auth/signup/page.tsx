"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Activity, Mail, Lock, AlertCircle, UserPlus } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // If Supabase immediately returns a session (confirm email = OFF),
      // we can save cookies and redirect
      if (data.session) {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}; SameSite=Lax; Secure`;
        router.push("/dashboard");
        router.refresh();
      } else {
        // Fallback in case email confirmation is turned ON
        alert("Registration successful! Please check your email inbox to confirm.");
        router.push("/auth/login");
      }
    } catch (err) {
      const error = err as Error;
      console.warn("Signup error:", error.message || error);
      setError("An unexpected error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-6 px-4">
      <div className="w-full max-w-md space-y-8 bg-gray-950/40 border border-gray-900 p-8 rounded-2xl shadow-xl shadow-indigo-500/5 backdrop-blur-md">
        
        {/* Brand/Logo Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
            <Activity className="h-6 w-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Create your Account</h2>
          <p className="text-xs text-gray-400">Get started with RAG agent performance monitoring</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-gray-950/80 border border-gray-850 focus:border-indigo-500/80 rounded-xl p-3 pl-10 text-sm text-white placeholder-gray-600 outline-none transition"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="password"
                type="password"
                required
                className="w-full bg-gray-950/80 border border-gray-850 focus:border-indigo-500/80 rounded-xl p-3 pl-10 text-sm text-white placeholder-gray-600 outline-none transition"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
              Confirm Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="confirm-password"
                type="password"
                required
                className="w-full bg-gray-950/80 border border-gray-850 focus:border-indigo-500/80 rounded-xl p-3 pl-10 text-sm text-white placeholder-gray-600 outline-none transition"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 text-sm transition shadow-lg shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Signing up...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                <span>Sign Up</span>
              </div>
            )}
          </button>
        </form>

        {/* Login Redirect Link */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-indigo-400 hover:underline hover:text-indigo-300 font-semibold transition">
              Login
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
