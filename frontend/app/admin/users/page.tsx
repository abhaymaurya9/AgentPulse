"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";
import clsx from "clsx";

type Profile = {
  id: string;
  email: string;
  approved: boolean;
  is_admin: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current logged in user to prevent self-demotion
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Fetch all profiles
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setProfiles(data || []);
    } catch (err) {
      console.warn("Error fetching profiles:", err);
      setError(
        "Failed to load user profiles. Please ensure database tables are set up correctly and you have admin rights."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleToggleApproved = async (profile: Profile) => {
    setActionLoadingId(profile.id + "-approve");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ approved: !profile.approved })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      // Update local state
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, approved: !p.approved } : p
        )
      );
    } catch (err) {
      console.warn("Error toggling approval:", err);
      alert("Failed to update user approval status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleAdmin = async (profile: Profile) => {
    if (profile.id === currentUserId) {
      alert("You cannot change your own administrator status.");
      return;
    }

    const confirmMsg = profile.is_admin
      ? `Are you sure you want to remove administrator privileges from ${profile.email}?`
      : `Are you sure you want to make ${profile.email} an administrator?`;

    if (!confirm(confirmMsg)) return;

    setActionLoadingId(profile.id + "-admin");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_admin: !profile.is_admin })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      // Update local state
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, is_admin: !p.is_admin } : p
        )
      );
    } catch (err) {
      console.warn("Error toggling admin status:", err);
      alert("Failed to update administrator status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredProfiles = profiles.filter((p) =>
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            User Administration
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage user registration requests, approve new accounts, and grant administrative access.
          </p>
        </div>
        <div>
          <button
            onClick={fetchProfiles}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-card/25 hover:bg-card/45 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh List
          </button>
        </div>
      </div>

      {/* Search and stats bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by email..."
            className="w-full bg-gray-950/80 border border-gray-850 focus:border-indigo-500/80 rounded-xl p-2.5 pl-10 text-sm text-white placeholder-gray-600 outline-none transition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs font-semibold text-gray-400 bg-gray-950/20 border border-gray-900 p-3 rounded-xl">
          <div>
            Total Users: <span className="text-white">{profiles.length}</span>
          </div>
          <div className="border-l border-gray-850 h-4" />
          <div>
            Pending:{" "}
            <span className="text-amber-400">
              {profiles.filter((p) => !p.approved).length}
            </span>
          </div>
          <div className="border-l border-gray-850 h-4" />
          <div>
            Admins:{" "}
            <span className="text-indigo-400">
              {profiles.filter((p) => p.is_admin).length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      {loading ? (
        /* Loading skeleton */
        <div className="border border-gray-900 rounded-xl bg-gray-950/20 overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-900/40 border-b border-gray-900" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 border-b border-gray-900/50 flex items-center justify-between px-4 gap-4"
            >
              <div className="h-4 w-1/3 bg-gray-900 rounded" />
              <div className="h-4 w-20 bg-gray-900 rounded" />
              <div className="h-4 w-20 bg-gray-900 rounded" />
              <div className="h-8 w-44 bg-gray-900 rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error page */
        <div className="flex h-64 items-center justify-center border border-gray-900 rounded-xl bg-card/10">
          <div className="max-w-md text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
              <AlertCircle className="h-6 w-6 text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Administration Error</h3>
            <p className="text-xs text-gray-400">{error}</p>
            <button
              onClick={fetchProfiles}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      ) : filteredProfiles.length === 0 ? (
        /* Empty search */
        <div className="border border-gray-900 rounded-xl p-12 text-center bg-card/10 text-gray-500 text-sm">
          <Users className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          No users found matching your search.
        </div>
      ) : (
        /* Profiles Table */
        <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-950/20">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold">
                <th className="p-4">User Email</th>
                <th className="p-4">Registered Date</th>
                <th className="p-4">Approval Status</th>
                <th className="p-4">Admin Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/60">
              {filteredProfiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="hover:bg-card/20 even:bg-card/5 text-gray-300 transition-all duration-150"
                >
                  {/* Email */}
                  <td className="p-4 font-medium text-white">
                    {profile.email}
                    {profile.id === currentUserId && (
                      <span className="ml-2 text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 px-1.5 py-0.5 rounded-md">
                        You
                      </span>
                    )}
                  </td>

                  {/* Registered Date */}
                  <td className="p-4 text-xs text-gray-400">
                    {new Date(profile.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>

                  {/* Approval badge */}
                  <td className="p-4">
                    {profile.approved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 border border-success/15 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning bg-warning/10 border border-warning/15 px-2.5 py-0.5 rounded-full">
                        <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
                        Pending Approval
                      </span>
                    )}
                  </td>

                  {/* Admin badge */}
                  <td className="p-4">
                    {profile.is_admin ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-2.5 py-0.5 rounded-full">
                        <Shield className="h-3.5 w-3.5" />
                        Administrator
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-900/50 border border-gray-800 px-2.5 py-0.5 rounded-full">
                        Standard User
                      </span>
                    )}
                  </td>

                  {/* Action buttons */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      {/* Approve/Revoke Button */}
                      <button
                        onClick={() => handleToggleApproved(profile)}
                        disabled={actionLoadingId !== null}
                        className={clsx(
                          "cursor-pointer inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
                          profile.approved
                            ? "border-rose-500/20 hover:border-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400"
                            : "border-indigo-600 hover:border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white"
                        )}
                      >
                        {actionLoadingId === profile.id + "-approve" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Saving</span>
                          </>
                        ) : profile.approved ? (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Revoke Access</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve Request</span>
                          </>
                        )}
                      </button>

                      {/* Admin role toggle */}
                      <button
                        onClick={() => handleToggleAdmin(profile)}
                        disabled={
                          actionLoadingId !== null ||
                          profile.id === currentUserId
                        }
                        className={clsx(
                          "cursor-pointer inline-flex items-center gap-1 rounded-lg border border-gray-800 hover:border-gray-700 bg-card/45 hover:bg-card px-3 py-1.5 text-xs font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
                          profile.is_admin ? "text-rose-400" : "text-gray-300 hover:text-white"
                        )}
                      >
                        {actionLoadingId === profile.id + "-admin" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {profile.is_admin ? "Remove Admin" : "Make Admin"}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
