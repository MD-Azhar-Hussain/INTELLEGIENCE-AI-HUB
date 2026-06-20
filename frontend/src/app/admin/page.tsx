"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Article, getUser, User } from "@/lib/store";
import Navbar from "@/components/Navbar";
import { 
  ShieldAlert, Activity, Users, Database, 
  Trash2, Copy, CheckCircle2, ChevronRight, 
  Search, RefreshCcw, Loader2, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

interface AdminStats {
  total_articles: number;
  total_users: number;
  active_engagements: number;
}

interface DuplicateCluster {
  original: Article;
  duplicate: Article;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "moderation" | "duplicates">("overview");

  const [searchQuery, setSearchQuery] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";

  useEffect(() => {
    const checkAuth = async () => {
      const u = getUser();
      if (!u) {
        console.log("No user found, redirecting...");
        router.push("/");
        return;
      }
      
      const ADMIN_EMAILS = ["admin@gmail.com", "tempmailer0099@gmail.com", "azhar@example.com"];
      const isRegisteredAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === u.email.toLowerCase());
      
      if (!isRegisteredAdmin) {
        console.log(`Unauthorized email: ${u.email}, redirecting...`);
        router.push("/");
        return;
      }

      setUser(u);
      setIsAuthorized(true);
      fetchAdminData(u.email);
    };
    checkAuth();
  }, []);

  const fetchAdminData = async (email: string) => {
    setLoading(true);
    try {
      const config = { headers: { "X-Officer-Email": email } };
      
      const [statsRes, dupsRes, artRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/stats`, config),
        axios.get(`${API_BASE}/admin/duplicates`, config),
        axios.get(`${API_BASE}/articles`, config)
      ]);

      setStats(statsRes.data);
      setDuplicates(dupsRes.data.clusters);
      setArticles(artRes.data);
    } catch (err) {
      console.error("Admin Access Revoked or Failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeAsset = async (id: string, title: string) => {
    if (!user) return;
    if (!confirm(`🌋 ATTENTION: Are you sure you want to permanently purge intelligence asset "${title}"? This cannot be undone.`)) return;

    try {
      await axios.delete(`${API_BASE}/admin/article/${id}`, {
        headers: { "X-Officer-Email": user.email }
      });
      // Refresh
      fetchAdminData(user.email);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Purge failed. Strategic assets protected.";
      alert(msg);
    }
  };

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    art.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-32 md:pt-40">
        {/* Admin Header */}
        <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <ShieldAlert size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Strategic Control Center</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-[var(--text-primary)]">
              Power <span className="opacity-20">House.</span>
            </h1>
          </div>
          
          <div className="flex bg-white dark:bg-white/[0.03] p-1.5 rounded-2xl border border-gray-100 dark:border-white/10">
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
            <TabButton active={activeTab === "moderation"} onClick={() => setActiveTab("moderation")} label="Moderation" />
            <TabButton active={activeTab === "duplicates"} onClick={() => setActiveTab("duplicates")} label="Duplicates" />
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4 text-gray-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest">Scanning Intelligence Frequency...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                <StatCard 
                  icon={<Database className="text-blue-600" />} 
                  label="Total Assets" 
                  value={stats?.total_articles || 0} 
                  sub="Global Intelligence"
                />
                <StatCard 
                  icon={<Users className="text-emerald-500" />} 
                  label="Registered Officers" 
                  value={stats?.total_users || 0} 
                  sub="Enlisted Personnel"
                />
                <StatCard 
                  icon={<Activity className="text-amber-500" />} 
                  label="Daily Engagements" 
                  value={stats?.active_engagements || 0} 
                  sub="Cross-Asset interactions"
                />

                <div className="md:col-span-3 luxury-card p-12 bg-blue-600/[0.02] border-blue-600/10">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <RefreshCcw size={18} className="text-blue-600" />
                    System Integrity Alert
                  </h3>
                  <p className="text-sm text-gray-500 max-w-2xl leading-relaxed mb-0">
                    The current intelligence feed is synchronized with Supabase Cloud. All deletions in this portal 
                    will immediately propagate to all connected officers. Duplicate detection is currently active and scanning for overlapping titles.
                  </p>
                </div>
              </motion.div>
            )}

            {/* MODERATION TAB */}
            {activeTab === "moderation" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inventory Moderation ({filteredArticles.length})</span>
                  <div className="flex items-center gap-4 flex-1 max-w-md">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                      <input 
                        type="text"
                        placeholder="Search Index by title or topic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-600 transition-all"
                      />
                    </div>
                    <button onClick={() => user && fetchAdminData(user.email)} className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase hover:text-blue-600 transition-colors whitespace-nowrap">
                      <RefreshCcw size={14} /> Resync
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filteredArticles.map((art) => (
                    <div 
                      key={art.id}
                      className="group luxury-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-600/30 bg-white dark:bg-white/[0.01]"
                    >
                      <div className="flex items-center gap-6 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 font-bold text-xs">
                          {art.category?.[0] || "?"}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg leading-tight mb-2 group-hover:text-blue-600 transition-colors">{art.title}</h4>
                          <div className="flex items-center gap-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">{art.category || "Uncategorized"}</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ID #{art.id ? art.id.slice(0, 6) : "???"}</span>
                            <button 
                               onClick={() => router.push(`/article/${art.id}`)}
                               className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-all"
                            >
                               View Full Intelligence <ChevronRight size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handlePurgeAsset(art.id, art.title)}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl text-red-500 font-bold text-[10px] uppercase tracking-widest border border-red-500/10 bg-red-500/5 hover:bg-red-500 hover:text-white transition-all md:opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} /> Purge Asset
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* DUPLICATES TAB */}
            {activeTab === "duplicates" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="px-4">
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <Copy size={24} className="text-amber-500" />
                    Cluster Overlap Detection
                  </h3>
                  <p className="text-sm text-gray-500">Detected {duplicates?.length || 0} potential intelligence collisions.</p>
                </div>

                {duplicates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-8">
                    {duplicates.map((cluster, i) => (
                      <div key={i} className="luxury-card p-10 border-amber-500/20 bg-amber-500/[0.01]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="p-8 rounded-[32px] bg-white dark:bg-white/[0.02] border border-emerald-500/20 relative">
                             <div className="absolute -top-3 left-8 px-4 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest">PRIMARY RECORD</div>
                             <h4 className="font-bold mb-4">{cluster.original.title}</h4>
                             <p className="text-xs text-gray-400 line-clamp-2">{cluster.original.summary?.[0] || "No summary available."}</p>
                             <div className="mt-6 flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase">
                                <CheckCircle2 size={14} /> Authenticated Asset
                             </div>
                          </div>

                          <div className="p-8 rounded-[32px] bg-white dark:bg-white/[0.02] border border-red-500/20 relative">
                             <div className="absolute -top-3 left-8 px-4 py-1 bg-red-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest">REDUNDANT DUPLICATE</div>
                             <h4 className="font-bold mb-4">{cluster.duplicate.title}</h4>
                             <p className="text-xs text-gray-400 line-clamp-2">{cluster.duplicate.summary?.[0] || "No summary available."}</p>
                             <button 
                                onClick={() => handlePurgeAsset(cluster.duplicate.id, cluster.duplicate.title)}
                                className="mt-6 flex items-center gap-2 px-6 py-2 rounded-xl text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest"
                             >
                                <Trash2 size={14} /> Purge Duplicate
                             </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-40 text-center luxury-card bg-emerald-500/[0.02] border-dashed border-emerald-500/20">
                     <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center mx-auto mb-8 text-emerald-500">
                        <CheckCircle2 size={32} />
                     </div>
                     <h3 className="text-xl font-bold mb-2">Feed Cleanliness Verified</h3>
                     <p className="text-sm text-gray-400">No contentcollisions detected in the current index.</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: any, label: string, value: number, sub: string }) {
  return (
    <div className="luxury-card p-10 flex flex-col h-full bg-white dark:bg-white/[0.02] border-white/5">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-8">
        {icon}
      </div>
      <div className="mt-auto">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">{label}</span>
        <div className="text-5xl font-extrabold tracking-tighter mb-2">{value}</div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest opacity-60 italic">{sub}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
          : "text-gray-400 hover:text-blue-600"
      }`}
    >
      {label}
    </button>
  );
}
