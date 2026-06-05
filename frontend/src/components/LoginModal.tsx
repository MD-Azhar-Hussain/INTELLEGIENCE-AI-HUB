"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Lock, Mail, ArrowRight, Loader2, UserCheck } from "lucide-react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: { isOpen: boolean, onClose: () => void, onLoginSuccess: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/login" : "/register";
      const res = await axios.post(`${API_BASE}${endpoint}`, { email, password });
      
      const user = { email, token: "session_token" }; // Simple session mock
      import("@/lib/store").then(m => m.saveUser(user));
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication Failed. Integrity check failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/60 dark:bg-black/90 backdrop-blur-3xl"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#0A0A0B] border border-gray-100 dark:border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-8 md:p-10">
              <div className="flex justify-between items-center mb-10">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <Shield className="text-white" size={24} fill="currentColor" />
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <h2 className="text-3xl font-bold mb-3 tracking-tight">
                {isLogin ? "Officer Entrance" : "Join the Service"}
              </h2>
              <p className="text-sm text-gray-400 font-medium mb-10">
                {isLogin ? "Confirm your credentials to access cloud intelligence." : "Create your tactical profile for UPSC preparation."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                      type="email" 
                      placeholder="Institutional Email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-blue-600 dark:focus:border-blue-600 transition-all font-medium"
                    />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                      type="password" 
                      placeholder="Access Token"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-blue-600 dark:focus:border-blue-600 transition-all font-medium"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest text-center"
                  >
                    {error}
                  </motion.div>
                )}

                <button 
                  disabled={loading} 
                  className="main-btn w-full flex items-center justify-center gap-3 py-5"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      {isLogin ? "Authorize Access" : "Create Profile"}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 pt-8 border-t border-gray-100 dark:border-white/5 text-center">
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-xs font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
                >
                  {isLogin ? "Request New Deployment?" : "Already in Service? Login"}
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-white/[0.02] p-6 text-center border-t border-gray-100 dark:border-white/5">
                <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                    <UserCheck size={12} />
                    Encrypted Institutional Sync
                </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
