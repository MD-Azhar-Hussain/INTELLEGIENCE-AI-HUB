"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import UploadModal from "@/components/UploadModal";
import { Sparkles, Trash2, ArrowRight, Fingerprint, Layers, LogIn, User as UserIcon, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Article, getArticles, addArticles, clearArticles, generateId, getUser, logout, User, getArticlesFromCloud } from "@/lib/store";
import LoginModal from "@/components/LoginModal";
import MethodologyModal from "@/components/MethodologyModal";
import ArticleStack from "@/components/ArticleStack";
import Link from "next/link";

export default function Home() {
  const [showUpload, setShowUpload] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "relevance">("date");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterImportant, setFilterImportant] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setArticles(getArticles());
    setUser(getUser());
    setIsMounted(true);
    // Cloud Sync & Migration on Mount
    const sync = async () => {
        const u = getUser();
        if (u) {
            // Transfer local baggage to cloud
            await import("@/lib/store").then(m => m.migrateLocalArticlesToCloud());
        }
        const cloudArticles = await import("@/lib/store").then(m => m.getArticlesFromCloud());
        setArticles(cloudArticles);
    };
    sync();
  }, []);

  const handleUploadSuccess = (response: any, filename: string) => {
    const rawList = Array.isArray(response) ? response : (response?.articles || []);
    
    // Ensure we are only mapping over valid objects
    const validList = (Array.isArray(rawList) ? rawList : [rawList]).filter(a => a && typeof a === "object" && !a.error);
    
    if (validList.length === 0 && !Array.isArray(rawList) && rawList?.error) {
        alert("Strategic AI Error: " + rawList.error);
        setShowUpload(false);
        return;
    }

    const formattedArticles: Article[] = validList.map(a => ({
      ...a,
      id: a.id || a.db_id || generateId(),
      ingested_at: a.ingested_at || new Date().toISOString(),
      filename: filename
    }));
    
    const updated = addArticles(formattedArticles);
    setArticles(updated);
    setShowUpload(false);
  };

  const handleClear = () => {
    if (!user) { setShowLogin(true); return; }
    if (confirm("Delete all intelligence assets?")) {
      clearArticles();
      setArticles([]);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  const availableCategories = ["All", ...Array.from(new Set((Array.isArray(articles) ? articles : []).map(a => a.category)))];

  const sortedArticles = (Array.isArray(articles) ? [...articles] : [])
    .filter(a => filterCategory === "All" || a.category === filterCategory)
    .filter(a => !filterImportant || a.isImportant)
    .filter(a => !filterCompleted || a.isCompleted)
    .sort((a, b) => {
      const dateA = a.ingested_at ? new Date(a.ingested_at).getTime() : 0;
      const dateB = b.ingested_at ? new Date(b.ingested_at).getTime() : 0;
      
      if (sortBy === "date") {
        return dateB - dateA;
      }
      return b.relevance_score - a.relevance_score;
    });

  // Enhanced Smart Grouping & Clustering Logic
  const groupArticlesByKeyword = (list: Article[]) => {
    const groups: Record<string, Article[]> = {};
    const seenArcIds = new Set<string>();
    
    // First pass: De-duplicate exact ARC ID matches to prevent clutter
    const uniqueList = list.filter(a => {
        const arcId = a.id?.split('-')[0] || a.title; // Use ID or Title as duplicate key
        if (seenArcIds.has(arcId)) return false;
        seenArcIds.add(arcId);
        return true;
    });

    uniqueList.forEach(article => {
      // Extract all potential cluster keys
      const potentialKeys = [
        article.primary_keyword,
        ...(article.keywords || []),
        ...(article.tags || []),
        article.category
      ].filter(Boolean).map(k => k!.trim().toLowerCase());

      // Find if this article belongs to an existing cluster
      let assignedKey = "";
      
      // We look for the most specific entity first (e.g. 'Israel' over 'International Relations')
      for (const key of potentialKeys) {
        // Find existing group that shares this keyword
        const existingKey = Object.keys(groups).find(groupKey => 
            groupKey.toLowerCase() === key || 
            (key.length > 3 && groupKey.toLowerCase().includes(key)) ||
            (groupKey.length > 3 && key.includes(groupKey.toLowerCase()))
        );

        if (existingKey) {
            assignedKey = existingKey;
            break;
        }
      }

      // If no cluster found, create a new one using the best available key
      if (!assignedKey) {
        assignedKey = article.primary_keyword || (article.keywords?.[0]) || article.category || "General Intelligence";
      }

      if (!groups[assignedKey]) groups[assignedKey] = [];
      groups[assignedKey].push(article);
    });

    return Object.entries(groups).map(([keyword, articles]) => ({
        keyword,
        articles
    })).sort((a, b) => b.articles.length - a.articles.length);
  };

  const groupedDecks = groupArticlesByKeyword(sortedArticles);

  if (!isMounted) return <div className="min-h-screen bg-[var(--bg-primary)]" />;

  return (
    <div className="min-h-screen pb-32 overflow-x-hidden">
      <Navbar onMethodologyClick={() => setShowMethodology(true)} />
      
      <main className="max-w-6xl mx-auto px-6 md:px-8 pt-32 md:pt-48">
        {/* Zen Hero Section */}
        <section className="text-center mb-24 md:mb-40">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-4 mb-8 md:mb-12"
          >
            <div className="h-px w-6 md:w-10 bg-gray-200 dark:bg-white/10" />
            <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] md:tracking-[0.5em] text-blue-600 dark:text-blue-400">
              {user ? `Welcome, ${user.name.toUpperCase()}` : "Intelligence Unit"}
            </span>
            <div className="h-px w-6 md:w-10 bg-gray-200 dark:bg-white/10" />
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-extrabold mb-8 md:mb-12 tracking-tighter leading-[1] md:leading-[0.9] text-[var(--text-primary)]"
          >
            {user ? "Personalized" : "Decipher the"} <br className="hidden md:block" />
            <span className="opacity-20">{user ? "Intelligence." : "Complex."}</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setShowMethodology(true)}
            className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 md:mb-16 leading-relaxed font-medium px-4 cursor-pointer hover:text-blue-600 transition-colors group"
          >
            {user 
              ? <span className="flex items-center justify-center gap-2">Strategic assets curated for your mission, {user.name.split(' ')[0]}. <span className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-sm font-black uppercase tracking-widest ml-2">View Methodology <ArrowRight size={14}/></span></span>
              : <span className="flex items-center justify-center gap-2 underline decoration-blue-600/30 underline-offset-8">High-yield methodology for civil services. <span className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-sm font-black uppercase tracking-widest ml-2">Explainer <ArrowRight size={14}/></span></span>}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center gap-6"
          >
            {user ? (
              <>
                <button onClick={() => setShowUpload(true)} className="main-btn group w-full sm:w-auto">
                  Start Ingestion
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={handleLogout} className="text-xs md:text-sm font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2">
                  <LogOut size={16} />
                  Terminate Session
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <button onClick={() => setShowLogin(true)} className="main-btn group w-full sm:w-auto px-12">
                  <LogIn size={20} />
                  Access Profile to Ingest
                </button>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[200px] text-center sm:text-left">
                  Viewing global feed. Logistics restricted to officers.
                </p>
              </div>
            )}
          </motion.div>
        </section>

        {/* Dashboard Headers */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 md:gap-8 border-b border-gray-100 dark:border-white/5 pb-10 md:pb-12">
          <div className="flex items-center gap-3 md:gap-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Intelligence Feed</h2>
            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="badge-pill-primary badge-pill">Assets: {articles.length}</div>
            <div className="badge-pill hidden md:block">UPSC 2024/25</div>
          </div>
        </div>

        {/* Sorting & Filtering Bar */}
        <div className="flex flex-col gap-10 mb-16 px-2">
          {/* Categories Horizontal List */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Filter by Topic</span>
              {!user && (
                 <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full">
                    Read-Only Mode
                 </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {availableCategories.map((cat, i) => (
                <button
                  key={`cat-${cat || i}`}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    filterCategory === cat
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20"
                      : "bg-white dark:bg-white/[0.02] text-gray-400 border-gray-100 dark:border-white/5 hover:border-blue-600/30 hover:text-blue-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
              
              <div className="w-px h-10 bg-gray-100 dark:bg-white/5 mx-2 hidden md:block" />

              <button
                onClick={() => setFilterImportant(!filterImportant)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                  filterImportant
                    ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20"
                    : "bg-white dark:bg-white/[0.02] text-amber-500/60 border-amber-500/10 hover:border-amber-500/30"
                }`}
              >
                Starred Only
              </button>
              
              <button
                onClick={() => setFilterCompleted(!filterCompleted)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                  filterCompleted
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "bg-white dark:bg-white/[0.02] text-emerald-500/60 border-emerald-500/10 hover:border-emerald-500/30"
                }`}
              >
                Completed Only
              </button>

              <div className="w-px h-10 bg-gray-100 dark:bg-white/5 mx-2 hidden md:block" />

              <div className="flex items-center gap-1 p-1 bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl">
                <button 
                  onClick={() => setGroupMode(false)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!groupMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-blue-600'}`}
                >
                  Feed
                </button>
                <button 
                  onClick={() => setGroupMode(true)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${groupMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-blue-600'}`}
                >
                  Decks
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-8">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Sort by</span>
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setSortBy("date")}
                  className={`text-xs font-bold uppercase tracking-widest transition-all pb-1 border-b-2 ${sortBy === "date" ? "text-blue-600 border-blue-600" : "text-gray-400 border-transparent hover:text-gray-600"}`}
                >
                  Date Recency
                </button>
                <button 
                  onClick={() => setSortBy("relevance")}
                  className={`text-xs font-bold uppercase tracking-widest transition-all pb-1 border-b-2 ${sortBy === "relevance" ? "text-blue-600 border-blue-600" : "text-gray-400 border-transparent hover:text-gray-600"}`}
                >
                  Relevance %
                </button>
              </div>
            </div>
            
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              Showing {sortedArticles.length} of {articles.length} assets
            </div>
          </div>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {groupMode ? (
            groupedDecks.length > 0 ? (
              groupedDecks.map((deck) => (
                <ArticleStack 
                  key={deck.keyword}
                  keyword={deck.keyword}
                  articles={deck.articles}
                  onToggle={(updated) => setArticles(updated)}
                  requestLogin={() => setShowLogin(true)}
                  isLoggedIn={!!user}
                  renderCard={(article) => (
                    <ArticleCard 
                      key={article.id || generateId()} 
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
                <div className="col-span-full py-40 text-center luxury-card bg-gray-50/10 border-dashed">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Strategic vacuum detected. No decks available.</p>
                </div>
            )
          ) : (
            sortedArticles.length > 0 ? (
              sortedArticles.map((article, idx) => (
                <ArticleCard 
                  key={article.id || idx} 
                  article={article} 
                  index={idx} 
                  onToggle={(updated) => setArticles(updated)}
                  requestLogin={() => setShowLogin(true)}
                  isLoggedIn={!!user}
                />
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="md:col-span-2 text-center py-48 luxury-card border-dashed bg-gray-50/30 dark:bg-white/[0.01]"
              >
                <div className="w-20 h-20 rounded-[2rem] bg-white dark:bg-white/5 shadow-sm border border-gray-100 dark:border-white/10 flex items-center justify-center mx-auto mb-8">
                  <Fingerprint className="text-gray-300" size={32} />
                </div>
                <h3 className="text-xl font-bold mb-3">Unit Awaiting Ingestion</h3>
                <p className="text-gray-400 font-medium text-sm">Upload a PDF to generate high-yield intelligence.</p>
              </motion.div>
            )
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showUpload && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 dark:bg-black/80 backdrop-blur-3xl"
              onClick={() => setShowUpload(false)}
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-xl"
            >
              <UploadModal onUploadSuccess={handleUploadSuccess} />
            </motion.div>
          </div>
        )}

        {showLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 dark:bg-black/80 backdrop-blur-3xl"
              onClick={() => setShowLogin(false)}
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-xl flex justify-center"
            >
              <LoginModal 
                onSuccess={() => { setUser(getUser()); setShowLogin(false); }} 
                onClose={() => setShowLogin(false)} 
              />
            </motion.div>
          </div>
        )}

        {showMethodology && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 dark:bg-black/80 backdrop-blur-3xl"
              onClick={() => setShowMethodology(false)}
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-4xl"
            >
              <MethodologyModal onClose={() => setShowMethodology(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ArticleCard({ article, index, onToggle, requestLogin, isLoggedIn }: { article: Article, index: number, onToggle: (articles: Article[]) => void, requestLogin: () => void, isLoggedIn: boolean }) {
  const [isImportant, setIsImportant] = useState(article.isImportant);
  const [isCompleted, setIsCompleted] = useState(article.isCompleted);
  
  const handleToggleImportant = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) { requestLogin(); return; }
    const { toggleArticleImportant } = await import("@/lib/store");
    const updated = await toggleArticleImportant(article.id);
    setIsImportant(!isImportant);
    onToggle(updated);
  };

  const handleToggleCompleted = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) { requestLogin(); return; }
    const { toggleArticleCompleted } = await import("@/lib/store");
    const updated = await toggleArticleCompleted(article.id);
    setIsCompleted(!isCompleted);
    onToggle(updated);
  };

  return (
    <Link href={`/article/${article.id}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="luxury-card p-12 flex flex-col h-full group"
      >
        <div className="flex justify-between items-center mb-10">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2.5">
              <span className="badge-pill badge-pill-primary">{article.category}</span>
              <span className="badge-pill">{article.gs_paper}</span>
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              {article.ingested_at ? `Ingested ${new Date(article.ingested_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : "Recently Added"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-3">
            {isLoggedIn && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleToggleImportant}
                  className={`p-2 rounded-lg transition-all ${isImportant ? "text-amber-500 bg-amber-500/10" : "text-gray-300 hover:text-amber-400"}`}
                >
                  <Sparkles size={16} fill={isImportant ? "currentColor" : "none"} />
                </button>
                <button 
                  onClick={handleToggleCompleted}
                  className={`p-2 rounded-lg transition-all ${isCompleted ? "text-emerald-500 bg-emerald-500/10" : "text-gray-300 hover:text-emerald-400"}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isCompleted ? "bg-emerald-500 border-emerald-500" : "border-gray-200"}`}>
                    {isCompleted && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </button>
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-black text-blue-600 tracking-widest">{article.relevance_score}%</span>
              <span className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter">Relevance</span>
            </div>
          </div>
        </div>
        
        <h3 className="text-3xl font-extrabold mb-8 group-hover:text-blue-600 transition-colors leading-[1.05] tracking-tight">
          {article.title}
        </h3>
        
        <p className="reading-text text-[var(--text-secondary)] line-clamp-3 mb-12">
          {Array.isArray(article.summary) ? article.summary[0] : (article.summary || article.content?.substring(0, 150) || "No summary available for this asset. Proceed to Insight for full details.")}
        </p>
        
        <div className="mt-auto flex items-center justify-between pt-10 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3 text-gray-400">
            <Layers size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">ARC ID #{article.id.slice(0, 4)}</span>
          </div>
          <div className="text-blue-600 font-bold text-sm flex items-center gap-2 group-hover:translate-x-1 transition-transform">
            Go to Insight <ArrowRight size={18} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
