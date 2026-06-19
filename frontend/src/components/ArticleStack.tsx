"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Article } from "@/lib/store";
import { Layers, ChevronRight, X, Sparkles, Target } from "lucide-react";
import { useState } from "react";

interface ArticleStackProps {
  keyword: string;
  articles: Article[];
  onToggle: (articles: Article[]) => void;
  requestLogin: () => void;
  isLoggedIn: boolean;
  renderCard: (article: Article) => React.ReactNode;
}

export default function ArticleStack({ keyword, articles, onToggle, requestLogin, isLoggedIn, renderCard }: ArticleStackProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (articles.length === 1) {
    return <>{renderCard(articles[0])}</>;
  }

  const topArticle = articles[0];

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setIsExpanded(true)}>
        {/* Stack Layers */}
        <div className="absolute inset-0 bg-white dark:bg-[#111112] border border-gray-100 dark:border-white/10 rounded-[32px] translate-x-4 translate-y-4 rotate-2 opacity-40 group-hover:rotate-3 transition-transform" />
        <div className="absolute inset-0 bg-white dark:bg-[#111112] border border-gray-100 dark:border-white/10 rounded-[32px] translate-x-2 translate-y-2 rotate-1 opacity-70 group-hover:rotate-2 transition-transform" />
        
        {/* Main Top Card */}
        <div className="relative luxury-card p-8 bg-white dark:bg-[#0A0A0B] border-blue-600/20">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/10 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-600/10">
              <Layers size={12} />
              Deck: {articles.length} Units
            </div>
            <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                <Target size={12} />
                Focus Cluster
            </div>
          </div>

          <h3 className="text-2xl font-bold mb-4 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
            {keyword} Series
          </h3>
          <p className="text-sm text-gray-500 font-medium mb-8 opacity-70 line-clamp-2">
            Multi-dimensional intelligence cluster including "{topArticle.title}" and {articles.length - 1} other related assets.
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-white/5">
            <div className="flex -space-x-3">
              {articles.slice(0, 3).map((a, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 border-2 border-white dark:border-[#0A0A0B] flex items-center justify-center text-[10px] font-bold">
                  {a.category[0]}
                </div>
              ))}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-1">
              Expand Deck <ChevronRight size={14} />
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
              <div className="p-8 md:p-12 flex items-center justify-between border-b border-white/10 bg-white/10 backdrop-blur-xl rounded-t-[40px]">
                <div>
                  <div className="flex items-center gap-3 mb-2 text-blue-600">
                    <Sparkles size={20} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Intelligence Cluster</span>
                  </div>
                  <h2 className="text-4xl font-bold tracking-tight">{keyword}</h2>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-red-500 transition-all text-gray-500 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                  {articles.map((article, idx) => (
                    <div key={article.id} className="h-full">
                      {renderCard(article)}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
