"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import UploadModal from "@/components/UploadModal";
import { Sparkles, Trash2, ArrowRight, Fingerprint, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Article, getArticles, addArticles, clearArticles, generateId } from "@/lib/store";
import Link from "next/link";

export default function Home() {
  const [showUpload, setShowUpload] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "relevance">("date");
  const [filterCategory, setFilterCategory] = useState<string>("All");

  useEffect(() => {
    setArticles(getArticles());
    setIsMounted(true);
  }, []);

  const handleUploadSuccess = (newArticles: any[], filename: string) => {
    const formattedArticles: Article[] = newArticles.map(a => ({
      ...a,
      id: generateId(),
      ingested_at: new Date().toISOString(),
      filename: filename
    }));

    const updated = addArticles(formattedArticles);
    setArticles(updated);
    setShowUpload(false);
  };

  const handleClear = () => {
    if (confirm("Delete all intelligence assets?")) {
      clearArticles();
      setArticles([]);
    }
  };

  const availableCategories = ["All", ...Array.from(new Set(articles.map(a => a.category)))];

  const sortedArticles = [...articles]
    .filter(a => filterCategory === "All" || a.category === filterCategory)
    .sort((a, b) => {
      const dateA = a.ingested_at ? new Date(a.ingested_at).getTime() : 0;
      const dateB = b.ingested_at ? new Date(b.ingested_at).getTime() : 0;

      if (sortBy === "date") {
        return dateB - dateA;
      }
      return b.relevance_score - a.relevance_score;
    });

  if (!isMounted) return <div className="min-h-screen bg-[var(--bg-primary)]" />;

  return (
    <div className="min-h-screen pb-32 overflow-x-hidden">
      <Navbar />

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
              Intelligence Unit
            </span>
            <div className="h-px w-6 md:w-10 bg-gray-200 dark:bg-white/10" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-bold mb-8 md:mb-12 tracking-tight leading-[1] md:leading-[0.9] text-[var(--text-primary)]"
          >
            Decipher the <br className="hidden md:block" />
            <span className="opacity-20">Complex.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 md:mb-16 leading-relaxed font-medium px-4"
          >
            High-yield methodology for civil services. Transform static documents into actionable, exam-oriented intelligence.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center px-6"
          >
            <button onClick={() => setShowUpload(true)} className="main-btn group w-full sm:w-auto">
              Start Ingestion
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={handleClear} className="text-xs md:text-sm font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2">
              <Trash2 size={16} />
              Reset Unit
            </button>
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
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Filter by Topic</span>
            <div className="flex flex-wrap gap-3">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border ${filterCategory === cat
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20"
                      : "bg-white dark:bg-white/[0.02] text-gray-400 border-gray-100 dark:border-white/5 hover:border-blue-600/30 hover:text-blue-600"
                    }`}
                >
                  {cat}
                </button>
              ))}
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
          {sortedArticles.length > 0 ? (
            sortedArticles.map((article, idx) => (
              <ArticleCard key={article.id} article={article} index={idx} />
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
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white/60 dark:bg-black/80 backdrop-blur-3xl"
            onClick={() => setShowUpload(false)}
          />
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative z-10 w-full max-w-xl"
          >
            <UploadModal onUploadSuccess={handleUploadSuccess} />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article, index }: { article: Article, index: number }) {
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
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-black text-blue-600 tracking-widest">{article.relevance_score}%</span>
            <span className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter">Relevance</span>
          </div>
        </div>

        <h3 className="text-3xl font-bold mb-8 group-hover:text-blue-600 transition-colors leading-[1.05] tracking-tight">
          {article.title}
        </h3>

        <p className="text-[16px] font-medium text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-12">
          {article.summary[0]}
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
