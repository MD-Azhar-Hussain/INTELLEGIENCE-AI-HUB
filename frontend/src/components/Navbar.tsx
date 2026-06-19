"use client";

import { Shield, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { motion } from "framer-motion";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[60] glass-navbar">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 md:gap-4 group">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-xl md:rounded-[1rem] flex items-center justify-center shadow-xl shadow-blue-600/20 group-hover:rotate-12 transition-transform">
            <Shield size={20} className="md:w-6 md:h-6" fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg md:text-xl leading-none tracking-tight">Intelligence</span>
            <span className="text-[9px] md:text-[10px] font-black tracking-[0.3em] uppercase opacity-40 mt-1">UPSC Hub</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8 lg:gap-12">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/import">Import News</NavLink>
          <NavLink href="#">Methodology</NavLink>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center bg-gray-50 border border-gray-200/50 text-gray-400 hover:text-blue-600 hover:bg-white hover:shadow-lg hover:shadow-gray-200/50 transition-all dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg hidden sm:block">
            <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-[10px] md:text-xs font-black">
              U
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[13px] font-bold text-gray-400 hover:text-blue-600 transition-colors tracking-wide uppercase"
    >
      {children}
    </Link>
  );
}
