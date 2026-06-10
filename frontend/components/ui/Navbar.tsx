"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Activity, Menu, X, LogOut, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper to determine if a link is active
  const isActive = (path: string) => {
    if (path === "/dashboard" || path === "/") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  const baseLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Agents List", href: "/agents" },
    { name: "Playground", href: "/playground" },
    { name: "Benchmarks", href: "/benchmarks" },
  ];
  
  const navLinks = isAdmin
    ? [...baseLinks, { name: "Admin Panel", href: "/admin/users" }]
    : baseLinks;

  useEffect(() => {
    // Check initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null);
      setIsAdmin(user?.app_metadata?.is_admin === true);
    });

    // Listen for auth state changes to synchronize cookies and state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email || null);
      setIsAdmin(session?.user?.app_metadata?.is_admin === true);
      if (session) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax; Secure`;
      } else {
        document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setUserEmail(null);
      setIsAdmin(false);
      setIsOpen(false);
      router.push("/auth/login");
      router.refresh();
    } catch (err) {
      const error = err as Error;
      console.warn("Logout error:", error.message || error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-900 bg-black/60 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <Activity className="h-6 w-6 text-indigo-500 animate-pulse" />
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AgentPulse
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition py-1 relative ${
                isActive(link.href)
                  ? "text-primary font-semibold after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-primary after:rounded-full"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {link.name}
            </Link>
          ))}

          {userEmail ? (
            <div className="flex items-center gap-4 border-l border-gray-800 pl-6 ml-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-950 border border-gray-850 py-1.5 px-3 rounded-xl max-w-[180px] truncate" title={userEmail}>
                <User className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate font-medium">{userEmail}</span>
              </div>
              <button
                onClick={handleLogout}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/40 hover:bg-danger/10 hover:text-danger px-3.5 py-2 text-xs font-semibold text-gray-400 transition-all duration-200"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-l border-gray-800 pl-6 ml-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 transition cursor-pointer"
              >
                Login
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex md:hidden p-2 text-gray-400 hover:text-white transition focus:outline-none"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {isOpen && (
        <div className="md:hidden border-b border-gray-900 bg-black/95 backdrop-blur-md px-6 py-4 space-y-3 flex flex-col transition-all duration-300">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={`text-sm font-medium transition py-2 ${
                isActive(link.href)
                  ? "text-primary font-semibold border-l-2 border-primary pl-2"
                  : "text-gray-400 hover:text-white pl-2"
              }`}
            >
              {link.name}
            </Link>
          ))}

          {userEmail ? (
            <div className="pt-2 border-t border-gray-900 space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-950 border border-gray-850 py-2 px-3 rounded-xl truncate">
                <User className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate font-medium">{userEmail}</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/40 py-2.5 text-sm font-semibold text-gray-400 hover:text-danger transition duration-200"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-gray-900">
              <Link
                href="/auth/login"
                onClick={() => setIsOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
