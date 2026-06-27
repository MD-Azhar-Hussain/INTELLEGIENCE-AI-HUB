"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Article } from "@/lib/store";
import { Newspaper, ChevronRight, X, Sparkles, BookOpen } from "lucide-react";
import { useState } from "react";

interface NewspaperClusterProps {
  filename: string;
  articles: Article[];
  onToggle: (articles: Article[]) => void;
  requestLogin: () => void;
  isLoggedIn: boolean;
  renderCard: (article: Article) => React.ReactNode;
}

export default function NewspaperCluster({ filename, articles, onToggle, requestLogin, isLoggedIn, renderCard }: NewspaperClusterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to parse filename prefix
  const parseFilename = () => {
    // Matches prefixes like:
    // hash:4ac5f9...__:
    // duplicate_4ac5f9...__:
    // hash:4ac5f9...:
    // duplicate:4ac5f9...:
    const match = filename.match(/^(hash|duplicate)[:_]([a-fA-F0-9]+)(?:__:)?[:_]?/i);
    if (match) {
      const type = match[1];
      const hash = match[2];
      // Strip prefix from filename
      const titleWithoutPrefix = filename.substring(match[0].length);
      return { hash, titleWithoutPrefix };
    }
    return { hash: null, titleWithoutPrefix: filename };
  };

  const { hash: fileHash, titleWithoutPrefix } = parseFilename();

  // Clean newspaper title (formats name)
  const getCleanTitle = () => {
    return titleWithoutPrefix
      .replace(/\.pdf$/i, "")
      .replace(/[-_~]/g, " ")
      .replace(/\b\d{2}\s\d{2}\s\d{4}\b/g, "") // remove numeric date if standalone
      .trim();
  };

  const newspaperTitle = getCleanTitle();

  // Extract a date from the filename or fallback to ingestion date
  const extractDate = () => {
    // Looks for patterns like 25-06-2026 or 25~06~2026 or 2026-06-25
    const dateMatch = filename.match(/(\d{2})[-~](\d{2})[-~](\d{4})/);
    if (dateMatch) {
      const [_, day, month, year] = dateMatch;
      // Convert e.g., "06" to month name
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month) - 1;
      return `${day} ${months[mIdx] || month} ${year}`;
    }
    
    // Fallback to first article's ingestion date
    if (articles[0]?.ingested_at) {
      return new Date(articles[0].ingested_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }
    return "Recent Edition";
  };

  const editionDate = extractDate();

  // Helper to parse page number from source e.g. "The Hindu — Page 3"
  const getPageNumber = (art: Article): number => {
    if (!art.source) return 999;
    const match = art.source.match(/Page\s+(\d+)/i);
    return match ? parseInt(match[1]) : 999;
  };

  // Group articles by page
  const articlesByPage: Record<number, Article[]> = {};
  articles.forEach(art => {
    const pNum = getPageNumber(art);
    if (!articlesByPage[pNum]) articlesByPage[pNum] = [];
    articlesByPage[pNum].push(art);
  });

  // Sorted list of pages
  const sortedPages = Object.keys(articlesByPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setIsExpanded(true)}>
        {/* Stack Layers for paper look */}
        <div className="absolute inset-0 bg-white dark:bg-[#111112] border border-gray-100 dark:border-white/10 rounded-[32px] translate-x-3 translate-y-3 opacity-40 transition-transform group-hover:translate-x-4 group-hover:translate-y-4" />
        <div className="absolute inset-0 bg-white dark:bg-[#111112] border border-gray-100 dark:border-white/10 rounded-[32px] translate-x-1.5 translate-y-1.5 opacity-70 transition-transform group-hover:translate-x-2 group-hover:translate-y-2" />
        
        {/* Main Card */}
        <div className="relative luxury-card p-8 bg-white dark:bg-[#0A0A0B] border-blue-600/20">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-600/10">
              <Newspaper size={12} />
              Newspaper Cluster
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {editionDate}
            </span>
          </div>

          <h3 className="text-2xl font-extrabold mb-4 tracking-tight leading-tight group-hover:text-blue-600 transition-colors uppercase break-words">
            {newspaperTitle}
          </h3>
          
          <p className="text-sm text-gray-500 font-medium mb-8 opacity-70">
            Contains {articles.length} premium high-yield civil services assets scanned and categorized from this edition.
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
              <BookOpen size={14} />
              <span>{sortedPages.length} Pages Ingested</span>
              {fileHash && (
                <span className="text-[8px] font-black uppercase bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-white/40 px-2 py-0.5 rounded border border-gray-100 dark:border-white/5 tracking-wider font-mono">
                  HASH #{fileHash.slice(0, 8)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-1">
              Read Edition <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 md:p-12 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 dark:bg-black/90 backdrop-blur-3xl"
              onClick={() => setIsExpanded(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-[120] w-full max-w-6xl max-h-[90vh] bg-white/50 dark:bg-white/[0.02] border border-white/20 rounded-[40px] shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-8 md:p-12 flex items-center justify-between border-b border-white/10 bg-white/10 backdrop-blur-xl rounded-t-[40px] gap-6">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-3 mb-2 text-blue-600">
                    <Sparkles size={20} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Newspaper Edition Cluster</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight break-words">{newspaperTitle}</h2>
                  <p className="text-gray-400 text-sm mt-1 flex flex-wrap items-center gap-2">
                    <span>{editionDate}</span>
                    <span>·</span>
                    <span>{articles.length} Ingested Articles</span>
                    {fileHash && (
                      <>
                        <span>·</span>
                        <span className="text-[9px] font-black bg-black/20 dark:bg-white/10 text-gray-500 dark:text-white/40 px-2 py-0.5 rounded tracking-wider font-mono select-all" title="Click to select hash">
                          HASH: {fileHash}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-red-500 transition-all text-gray-500 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Body: Page by Page list */}
              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar space-y-12">
                {sortedPages.map(page => {
                  const pageArticles = articlesByPage[page];
                  return (
                    <div key={page} className="space-y-6">
                      {/* Page Divider */}
                      <div className="flex items-center gap-4">
                        <div className="px-4 py-1.5 bg-blue-600/10 text-blue-600 border border-blue-600/10 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          Page {page === 999 ? "Unspecified" : page}
                        </div>
                        <div className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {pageArticles.length} {pageArticles.length === 1 ? "Article" : "Articles"}
                        </span>
                      </div>
                      
                      {/* Page Articles Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {pageArticles.map(article => (
                          <div key={article.id} className="h-full">
                            {renderCard(article)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
