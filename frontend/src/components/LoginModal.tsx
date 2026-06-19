"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogIn, UserPlus, Mail, Lock, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import axios from "axios";

interface LoginModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function LoginModal({ onSuccess, onClose }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/login" : "/register";
      const payload = isLogin ? { email, password } : { email, password, name };
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";
      const response = await axios.post(`${apiUrl}${endpoint}`, payload);
      
      if (response.data) {
        const { saveUser } = await import("@/lib/store");
        saveUser({
          email: response.data.user?.email || email,
          name: response.data.user?.name || (isLogin ? "Officer" : name),
          isLoggedIn: true
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="w-full max-w-md bg-white dark:bg-[#111112] rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden relative"
    >
      <div className="p-10 md:p-12">
        <div className="flex justify-between items-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            {isLogin ? <LogIn size={24} /> : <UserPlus size={24} />}
          </div>
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <h2 className="text-3xl font-extrabold mb-3 tracking-tight">
          {isLogin ? "Welcome Back, Officer" : "Enlist Intelligence"}
        </h2>
        <p className="text-sm text-gray-400 font-medium mb-10">
          {isLogin ? "Enter your credentials to access strategic assets." : "Create your secure profile to begin ingestion."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <ShieldCheck size={18} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Officer Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl text-sm font-bold focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Secure Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl text-sm font-bold focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Access Key</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl text-sm font-bold focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] font-bold text-red-500 text-center"
            >
              {error}
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? "Authenticate" : "Initialize Enlistment")}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="mt-10 pt-10 border-t border-gray-100 dark:border-white/5 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors"
          >
            {isLogin ? "New Officer? Create Profile" : "Existing Profile? Login"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
