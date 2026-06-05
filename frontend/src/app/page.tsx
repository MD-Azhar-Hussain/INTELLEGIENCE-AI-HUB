"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import UploadModal from "@/components/UploadModal";
import LoginModal from "@/components/LoginModal";
import ArticleStack from "@/components/ArticleStack";
import { 
  Sparkles, Trash2, ArrowRight, Fingerprint, Layers, 
  LogIn, LogOut, CheckCircle2, Shield, Target, BookOpen, Clock, Users, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Article, getArticles, addArticles, clearArticles, generateId, 
  getUser, logout, getArticlesFromCloud 
} from "@/lib/store";
import Link from "next/link";

export default function Home() {
  const [showUpload, setShowUpload] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "relevance">("date");
  const [filterCategory, setFilterCategory] = useState<string>("All");

  useEffect(() => {
    setArticles(getArticles());
    setUser(getUser());
    setIsMounted(true);
    
    // Cloud Sync on Mount
    const sync = async () => {
        const u = getUser();
        if (u) {
            await import("@/lib/store").then(m => m.migrateLocalArticlesToCloud());
        }
        const cloudArticles = await getArticlesFromCloud();
        setArticles(cloudArticles);
    };
    sync();
  }, []);

  const handleUploadSuccess = (newArticles: any[], filename: string) => {
    const formattedArticles: Article[] = newArticles.map(a => ({
      ...a,
      id: a.id || a.db_id || generateId(), // Prefer DB ID if exists
      ingested_at: new Date().toISOString(),
      filename: filename
    }));

    const updated = addArticles(formattedArticles);
    setArticles(updated);
    setShowUpload(false);
    
    // Refetch to sync with cloud
    getArticlesFromCloud().then(setArticles);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.reload();
  };

  // Intelligent Grouping Logic
  const groupArticlesByKeyword = (list: Article[]) => {
    const groups: { [key: string]: Article[] } = {};
    list.forEach(article => {
        // Use primary_keyword or a common denominator from summary/title
        const key = (article as any).primary_keyword || article.category;
        if (!groups[key]) groups[key] = [];
        groups[key].push(article);
    });
    return groups;
  };

  const filtered = articles.filter(a => filterCategory === "All" || a.category === filterCategory);
  const grouped = groupArticlesByKeyword(filtered);
  const groupedKeys = Object.keys(grouped).sort((a,b) => {
      if (sortBy === "relevance") return grouped[b][0].relevance_score - grouped[a][0].relevance_score;
      return new Date(grouped[b][0].ingested_at).getTime() - new Date(grouped[a][0].ingested_at).getTime();
  });

  if (!isMounted) return <div className="min-h-screen bg-[var(--bg-primary)] px-2" />;

  return (
    <div className="min-h-screen pb-32 overflow-x-hidden selection:bg-blue-100 selection:text-blue-700">
      <Navbar onMethodologyClick={() => setShowMethodology(true)} />

      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-32 md:pt-56">
        {/* Zen Hero Section */}
        <section className="text-center mb-24 md:mb-48 relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-100/30 blur-[120px] rounded-full -z-10"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-4 mb-8 md:mb-12"
          >
            {!user ? (
              <div className="px-4 py-1.5 bg-gray-100 dark:bg-white/5 rounded-full text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 flex items-center gap-2">
                 <Shield size={12} /> Read-Only Mode
              </div>
            ) : (
                <div className="px-4 py-1.5 bg-blue-600/10 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 border border-blue-600/20">
                    <Sparkles size={12} /> Officer Account Active
                </div>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-[9.5rem] font-bold mb-10 md:mb-16 tracking-tight leading-[0.9] text-[var(--text-primary)]"
          >
            Decipher the <br className="hidden md:block" />
            <span className="text-gray-200 dark:text-white/10 uppercase italic">Complex.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-2xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-16 md:mb-24 leading-relaxed font-medium px-4 opacity-70"
          >
            Transform volatile global news into actionable, exam-oriented intelligence units. 
            Automated entity clustering for UPSC Civil Services.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center items-center px-6"
          >
            {user ? (
                <>
                <button 
                  onClick={() => setShowUpload(true)} 
                  className="main-btn group w-full md:w-auto px-16 shadow-2xl shadow-blue-600/20"
                >
                  <Layers size={20} />
                  Start Ingestion
                </button>
                <button onClick={handleLogout} className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 hover:text-red-500 transition-all flex items-center gap-3">
                  <LogOut size={18} /> Sign Out
                </button>
                </>
            ) : (
                <button 
                    onClick={() => setShowLogin(true)} 
                    className="main-btn group w-full md:w-auto px-16 bg-black dark:bg-white text-white dark:text-black border-none"
                >
                    <LogIn size={20} />
                    Officer Access
                </button>
            )}
          </motion.div>
        </section>

        {/* Dashboard Headers */}
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-8 border-b border-gray-100 dark:border-white/5 pb-16">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-blue-600">
                <Target size={20} />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Intelligence Feed</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">Strategic Assets</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-6 py-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-3">
                Total Intelligence: <span className="text-blue-600 font-black text-sm">{articles.length}</span>
            </div>
          </div>
        </div>

        {/* Sorting & Bar */}
        <div className="flex flex-col gap-12 mb-20">
          <div className="flex flex-wrap gap-3">
              {["All", ...Array.from(new Set(articles.map(a => a.category)))].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${filterCategory === cat
                      ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20"
                      : "bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-[var(--text-primary)]"
                    }`}
                >
                  {cat}
                </button>
              ))}
          </div>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-16">
          {groupedKeys.length > 0 ? (
            groupedKeys.map((key) => (
                <ArticleStack 
                    key={key}
                    keyword={key}
                    articles={grouped[key]}
                    onToggle={(updated) => setArticles(updated)}
                    requestLogin={() => setShowLogin(true)}
                    isLoggedIn={!!user}
                    renderCard={(article) => (
                        <ArticleCard 
                            article={article} 
                            index={0} 
                            onToggle={(updated) => setArticles(updated)}
                            requestLogin={() => setShowLogin(true)}
                            isLoggedIn={!!user}
                        />
                    )}
                />
            ))
          ) : (
            <div className="md:col-span-3 py-32 text-center opacity-30">
               <Fingerprint size={64} className="mx-auto mb-8" />
               <p className="text-lg font-bold tracking-widest uppercase">Grid Exhausted. Awaiting Deployment.</p>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <UploadModal 
        isOpen={showUpload} 
        onClose={() => setShowUpload(false)} 
        onUploadSuccess={handleUploadSuccess} 
      />
      
      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLoginSuccess={(u) => { setUser(u); setArticles(getArticles()); }} 
      />

      <MethodologyOverlay 
        isOpen={showMethodology} 
        onClose={() => setShowMethodology(false)} 
      />
    </div>
  );
}

function ArticleCard({ article, index, onToggle, requestLogin, isLoggedIn }: { article: Article, index: number, onToggle: (articles: Article[]) => void, requestLogin: () => void, isLoggedIn: boolean }) {
  const [isImportant, setIsImportant] = useState(article.isImportant);
  const [isCompleted, setIsCompleted] = useState(article.isCompleted);
  
  const handleToggleImportant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) { requestLogin(); return; }
    import("@/lib/store").then(async m => {
      const updated = await m.toggleArticleImportant(article.id);
      setIsImportant(!isImportant);
      onToggle(updated);
    });
  };

  const handleToggleCompleted = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) { requestLogin(); return; }
    import("@/lib/store").then(async m => {
      const updated = await m.toggleArticleCompleted(article.id);
      setIsCompleted(!isCompleted);
      onToggle(updated);
    });
  };

  return (
    <Link 
        href={article.id ? `/article/${article.id}` : "/"}
        onClick={(e) => { if(!article.id) e.preventDefault(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="luxury-card p-10 md:p-12 flex flex-col h-full group bg-white dark:bg-[#0A0A0B]"
      >
        <div className="flex justify-between items-start mb-10">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <span className="badge-pill bg-blue-600/10 text-blue-600 border-none">{article.category}</span>
              <span className="badge-pill">{article.gs_paper}</span>
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              {article.ingested_at ? `Verified: ${new Date(article.ingested_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : "New Asset"}
            </span>
          </div>
          <div className="flex gap-2">
            {isLoggedIn && (
                <>
                <button onClick={handleToggleImportant} className={`p-2 rounded-lg transition-all ${isImportant ? "text-amber-500 bg-amber-500/10" : "text-gray-300 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-white/5"}`}>
                    <Sparkles size={16} fill={isImportant ? "currentColor" : "none"} />
                </button>
                <button onClick={handleToggleCompleted} className={`p-2 rounded-lg transition-all ${isCompleted ? "text-emerald-500 bg-emerald-500/10" : "text-gray-300 hover:text-emerald-500"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 transition-all ${isCompleted ? "bg-emerald-500 border-emerald-500 flex items-center justify-center" : "border-gray-200"}`}>
                        {isCompleted && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                </button>
                </>
            )}
            <div className="text-right ml-2 border-l border-gray-100 dark:border-white/5 pl-4">
                <div className="text-xl font-black text-blue-600 leading-none">{article.relevance_score}%</div>
                <div className="text-[8px] font-black uppercase text-gray-300 tracking-tighter mt-1">Relevance</div>
            </div>
          </div>
        </div>

        <h3 className="text-2xl md:text-3xl font-bold mb-8 group-hover:text-blue-600 transition-colors leading-[1.1] tracking-tight">
          {article.title}
        </h3>

        <p className="reading-text text-[var(--text-secondary)] line-clamp-3 mb-12 opacity-60">
          {article.summary[0]}
        </p>

        <div className="mt-auto flex items-center justify-between pt-10 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3 text-gray-400">
            <Layers size={16} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">{article.id ? `ARC ID #${article.id.slice(0, 4)}` : "GENERIC"}</span>
          </div>
          <div className="text-blue-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-1 transition-transform">
            Go to Insight <ArrowRight size={16} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function MethodologyOverlay({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-white dark:bg-[#080809] flex flex-col">
            <div className="max-w-4xl mx-auto px-6 py-20 md:py-32 w-full">
                <button onClick={onClose} className="fixed top-8 right-8 w-14 h-14 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                    <X size={24} />
                </button>

                <div className="flex items-center gap-4 text-blue-600 mb-8">
                    <Shield size={32} />
                    <span className="text-sm font-black uppercase tracking-[0.4em]">Intelligence Methodology</span>
                </div>

                <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-16 leading-[0.9]">
                    The High-Yield <br /> <span className="text-gray-300 dark:text-white/10">Architecture.</span>
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-24">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-blue-600">
                            <Clock size={20} />
                            <h3 className="text-lg font-black uppercase tracking-widest">Temporal Density</h3>
                        </div>
                        <p className="text-xl text-[var(--text-secondary)] leading-relaxed">
                            We condense 3,000-word tactical reports into 400-word intelligence units without losing critical GS terminology or constitutional nuances.
                        </p>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-emerald-500">
                            <BookOpen size={20} />
                            <h3 className="text-lg font-black uppercase tracking-widest">Syllabus Mapping</h3>
                        </div>
                        <p className="text-xl text-[var(--text-secondary)] leading-relaxed">
                            Every asset is automatically categorized by GS Paper (I-IV) and tagged with specific entities like 'Supreme Court,' 'Parliament,' or 'UNSC.'
                        </p>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-amber-500">
                            <Sparkles size={20} />
                            <h3 className="text-lg font-black uppercase tracking-widest">Adaptive MCQ</h3>
                        </div>
                        <p className="text-xl text-[var(--text-secondary)] leading-relaxed">
                            Generating 3-5 high-difficulty MCQs per unit to sharpen recall and simulate real preliminary conditions.
                        </p>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-purple-500">
                            <Users size={20} />
                            <h3 className="text-lg font-black uppercase tracking-widest">Dual-Stakeholder Logic</h3>
                        </div>
                        <p className="text-xl text-[var(--text-secondary)] leading-relaxed">
                            All analysis includes background context and multiple viewpoints, critical for the Mains GS Essays and Interview preparation.
                        </p>
                    </div>
                </div>

                <div className="p-12 md:p-20 luxury-card bg-blue-600 border-none text-white overflow-hidden relative">
                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">Integrated Study Solution</h2>
                        <p className="text-2xl font-light opacity-80 mb-12 leading-relaxed">
                            Stop skimming newspapers. Start ingesting intelligence. Built for dedicated Civil Services aspirants who value time and structured learning.
                        </p>
                        <button onClick={onClose} className="px-12 py-5 bg-white text-blue-600 rounded-2xl font-black uppercase tracking-widest flex items-center gap-4 hover:scale-105 transition-transform">
                            Return to Command <ArrowRight size={20} />
                        </button>
                    </div>
                    <Shield size={400} className="absolute -bottom-20 -right-20 text-white/5 rotate-12" />
                </div>
            </div>
        </div>
    );
}
