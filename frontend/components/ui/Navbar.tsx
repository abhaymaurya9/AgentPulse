"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Menu, X } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Helper to determine if a link is active
  const isActive = (path: string) => {
    if (path === "/dashboard" || path === "/") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  const navLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Agents List", href: "/agents" },
    { name: "Playground", href: "/playground" },
  ];

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
                  ? "text-indigo-400 font-semibold after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-indigo-500 after:rounded-full"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/agents/register"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 transition cursor-pointer"
          >
            Register Agent
          </Link>
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
                  ? "text-indigo-400 font-semibold border-l-2 border-indigo-500 pl-2"
                  : "text-gray-400 hover:text-white pl-2"
              }`}
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/agents/register"
            onClick={() => setIsOpen(false)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            Register Agent
          </Link>
        </div>
      )}
    </header>
  );
}
