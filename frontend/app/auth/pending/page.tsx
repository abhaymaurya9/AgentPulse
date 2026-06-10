"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Clock, ShieldAlert, LogOut, RefreshCw } from "lucide-react";

export default function PendingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current user email
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email || null);
    });

    // Check status automatically every 10 seconds
    const interval = setInterval(() => {
      checkStatus(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const checkStatus = async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      // Refresh the session to get updated app_metadata
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (data?.session) {
        const approved = data.session.user.app_metadata?.approved === true;
        
        // Synchronize the access token cookie
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}; SameSite=Lax; Secure`;

        if (approved) {
          router.push("/dashboard");
          router.refresh();
          return;
        }
      }

      if (!silent) {
        setStatusMessage("Your application is still pending review.");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      console.warn("Error checking status:", err);
      if (!silent) {
        setStatusMessage("Could not check status. Please try again.");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } finally {
      if (!silent) setChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      router.push("/auth/login");
      router.refresh();
    } catch (err) {
      console.warn("Logout error:", err);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-6 px-4">
      <div className="w-full max-w-md space-y-8 bg-gray-950/40 border border-gray-900 p-8 rounded-2xl shadow-xl shadow-indigo-500/5 backdrop-blur-md text-center">
        
        {/* Animated Icon */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Access Request Pending</h2>
          <p className="text-sm text-gray-400 max-w-sm">
            Thank you for registering! Your account request is currently awaiting administrator approval.
          </p>
        </div>

        {/* User Info */}
        {email && (
          <div className="bg-gray-900/40 border border-gray-900 rounded-xl p-3 text-xs text-gray-400">
            Registered as: <span className="font-semibold text-white">{email}</span>
          </div>
        )}

        {/* Feedback Messages */}
        {statusMessage && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold animate-fade-in">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => checkStatus(false)}
            disabled={checking}
            className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 text-sm transition shadow-lg shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Check Approval Status</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-900/20 hover:bg-rose-500/10 hover:text-rose-400 text-gray-400 font-semibold py-2.5 text-sm transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out / Use Another Account</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-500">
          This page polls for approval status automatically. We will redirect you once approved.
        </p>

      </div>
    </div>
  );
}
