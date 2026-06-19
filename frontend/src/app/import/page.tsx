"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ArrowRight, Loader2, BookOpen, Calendar, User, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { addArticles, generateId, getUser } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function ImportNewsPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [article, setArticle] = useState<any>(null);
  const [error, setError] = useState("");

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError("");
    setArticle(null);

    try {
      const user = getUser();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";
      const response = await axios.post(`${apiUrl}/import-news`, { url }, {
        headers: { "X-Officer-Email": user?.email || "" }
      });
      setArticle({ ...response.data, url }); // Store the URL as well
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch article. Please check the URL.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleAnalyze = async () => {
    if (!article) return;

    setIsAnalyzing(true);
    setError("");

    try {
      const user = getUser();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";
      
      // If the article is ALREADY analyzed (came from import-news fully processed), just save it
      if (article.summary && Array.isArray(article.summary) && article.summary.length > 0) {
        addArticles([article]);
        router.push("/");
        return;
      }

      const response = await axios.post(`${apiUrl}/analyze-text`, {
        text: article.content,
        title: article.title
      }, {
        headers: { "X-Officer-Email": user?.email || "" }
      });

      const analysis = response.data.articles;
      
      // If the AI returned an error object
      if (analysis && analysis.error) {
        throw new Error(analysis.error);
      }

      const list = Array.isArray(analysis) ? analysis : [analysis];

      const newArticles = list.map((a: any) => ({
        ...a,
        id: a.id || generateId(),
        ingested_at: a.ingested_at || new Date().toISOString(),
        filename: new URL(article.url).hostname
      }));

      addArticles(newArticles);

      // Redirect to dashboard to see the new articles
      router.push("/");
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "AI analysis failed. Please try again.";
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 md:px-8 pt-32 md:pt-48">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 md:mb-20"
        >
          <div className="flex items-center justify-center gap-3 mb-4 md:mb-6 text-blue-600">
            <Globe size={24} />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Web Integration</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 md:mb-6 tracking-tight">Import Intelligence</h1>
          <p className="text-gray-400 max-w-xl mx-auto text-base md:text-lg px-4">
            Paste a news article URL to extract clean, ad-free intelligence directly into your workspace.
          </p>
        </motion.div>

        {/* Input Section */}
        <section className="mb-12 md:mb-20">
          <form onSubmit={handleImport} className="relative group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://news-url.com/..."
              className="w-full h-16 md:h-20 bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl md:rounded-3xl px-6 md:px-8 pr-32 md:pr-40 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xl shadow-black/5"
            />
            <button
              type="submit"
              disabled={isLoading || !url}
              className="absolute right-2 top-2 bottom-2 px-4 md:px-8 bg-blue-600 text-white rounded-xl md:rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 text-xs md:text-base"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  <span className="hidden sm:inline">Extract Content</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-red-500 text-xs md:text-sm font-medium pl-4"
            >
              {error}
            </motion.p>
          )}
        </section>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {article && (
            <motion.div
              key="article"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="luxury-card p-8 md:p-20"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 mb-8 md:mb-12 text-gray-400">
                <div className="flex flex-wrap gap-4">
                  {article.date && (
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                      <Calendar size={14} />
                      {article.date}
                    </div>
                  )}
                  {article.author && (
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                      <User size={14} />
                      {article.author}
                    </div>
                  )}
                </div>
                <div className="sm:ml-auto flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-widest">
                  <CheckCircle2 size={16} />
                  Pure Content
                </div>
              </div>

              <h2 className="text-3xl md:text-5xl font-black mb-8 md:mb-12 tracking-tight leading-[1.2] md:leading-[1.1]">
                {article.title}
              </h2>

              <div className="space-y-6 md:space-y-8">
                {typeof article.content === 'string' && article.content.split('\n').map((para: string, i: number) => (
                  para.trim() && (
                    <p key={i} className="text-lg md:text-xl leading-[1.7] md:leading-[1.8] text-[var(--text-secondary)] font-medium">
                      {para}
                    </p>
                  )
                ))}
                {!article.content && (
                   <p className="text-red-500 font-bold uppercase text-xs tracking-widest bg-red-500/10 p-4 rounded-xl">
                      WARNING: No readable content extracted from this URL.
                   </p>
                )}
              </div>

              <div className="mt-12 md:mt-20 pt-8 md:pt-12 border-t border-gray-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
                <div className="flex items-center gap-3 text-gray-400 italic text-[11px] md:text-sm">
                  <BookOpen size={16} />
                  From {new URL(article.url).hostname}
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="main-btn group w-full md:w-auto text-sm md:text-base"
                >
                  {isAnalyzing ? (
                    <>
                      Analyzing Intelligence...
                      <Loader2 className="animate-spin" size={20} />
                    </>
                  ) : article.summary ? (
                    <>
                      Save to Dashboard
                      <ArrowRight size={20} />
                    </>
                  ) : (
                    <>
                      Analyze for UPSC
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {!article && !isLoading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-32 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-8 border border-gray-100 dark:border-white/10">
                <Globe size={32} className="text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium">Global sources supported (The Hindu, Indian Express, BBC, etc.)</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
