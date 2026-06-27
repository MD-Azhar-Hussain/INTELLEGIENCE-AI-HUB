"use client";

import { useState, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, Upload, ArrowRight, Loader2, CheckCircle2,
  FileText, AlertCircle, X, ChevronRight, Layers, BookOpen,
  Zap, Clock, Check, Sparkles
} from "lucide-react";
import axios from "axios";
import { addArticles, getUser } from "@/lib/store";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Story {
  headline: string;
  excerpt: string;
  relevance_score?: number;
  category?: string;
}

interface ScannedPage {
  page: number;
  page_index: number;
  stories: Story[];
}

interface ScanResult {
  session_id: string;
  filename: string;
  total_pages: number;
  total_stories: number;
  pages: ScannedPage[];
}

type IngestionStatus = "queued" | "analyzing" | "done" | "error";

interface IngestionJob {
  id: string;
  headline: string;
  page: number;
  page_index: number;
  status: IngestionStatus;
  article?: any;
  error?: string;
}

// ── Stage type ─────────────────────────────────────────────────────────────────
type Stage = "upload" | "scanning" | "checklist" | "ingesting";

export default function NewspaperPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stage state
  const [stage, setStage] = useState<Stage>("upload");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Scanning state
  const [uploadPct, setUploadPct] = useState(0);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [isAlreadyIngested, setIsAlreadyIngested] = useState(false);

  // Checklist state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Ingestion state
  const [jobs, setJobs] = useState<IngestionJob[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";

  // ── Selection key builder ──────────────────────────────────────────────────
  const storyKey = (pageIndex: number, headline: string) =>
    `${pageIndex}::${headline}`;

  // ── Drag & Drop handlers ───────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".pdf")) setFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  // ── Phase 1: Upload + Two-phase Scan ──────────────────────────────────────
  const handleScan = async () => {
    if (!file) return;
    setStage("scanning");
    setScanError("");
    setUploadPct(0);
    setScanProgress({ current: 0, total: 0 });
    setIsAlreadyIngested(false);

    try {
      const user = getUser();
      const formData = new FormData();
      formData.append("file", file);

      // ── Step A: Upload PDF & render pages (fast, no AI, 3-5s) ──────────────
      const uploadRes = await axios.post(`${apiUrl}/scan-newspaper`, formData, {
        headers: { "X-Officer-Email": user?.email || "" },
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });

      const { session_id, total_pages, filename, already_ingested, pages } = uploadRes.data;
      if (!session_id || !total_pages) throw new Error("Invalid server response. Please retry.");

      if (already_ingested) {
        setIsAlreadyIngested(true);
        setScanResult({ session_id, filename, total_pages, total_stories: pages.reduce((sum: number, p: any) => sum + p.stories.length, 0), pages });
        // Select all already ingested stories
        const allKeys = new Set<string>();
        pages.forEach((p: any) => p.stories.forEach((s: any) => allKeys.add(storyKey(p.page_index, s.headline))));
        setSelected(allKeys);
        setStage("checklist");
        return;
      }

      // ── Step B: Scan each page one-by-one (live per-page progress) ──────────
      const allPages: ScannedPage[] = [];
      for (let i = 0; i < total_pages; i++) {
        setScanProgress({ current: i + 1, total: total_pages });

        // 2s gap between page requests keeps us within Gemini free-tier RPM limits.
        // Skip the delay on the very first page so scanning feels responsive.
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        try {
          const pageRes = await axios.post(`${apiUrl}/scan-page`, {
            session_id,
            page_index: i,
          }, {
            headers: { "X-Officer-Email": user?.email || "" },
          });
          if (pageRes.data.stories?.length > 0) {
            allPages.push(pageRes.data as ScannedPage);
          }
        } catch {
          // A single page failure is not fatal — continue scanning remaining pages
          console.warn(`Page ${i + 1} scan failed, skipping.`);
        }
      }

      const total_stories = allPages.reduce((sum, p) => sum + p.stories.length, 0);
      setScanResult({ session_id, filename, total_pages, total_stories, pages: allPages });
      setSelected(new Set());
      setStage("checklist");

    } catch (err: any) {
      setScanError(err.response?.data?.detail || err.message || "Scan failed. Please try again.");
      setStage("upload");
    }
  };

  // ── Checklist toggles ──────────────────────────────────────────────────────
  const toggleStory = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (!scanResult) return;
    const allKeys = scanResult.pages.flatMap(p =>
      p.stories.map(s => storyKey(p.page_index, s.headline))
    );
    setSelected(prev =>
      prev.size === allKeys.length ? new Set() : new Set(allKeys)
    );
  };

  // ── Phase 2: Parallel ingestion ────────────────────────────────────────────
  const handleIngest = async () => {
    if (!scanResult || selected.size === 0) return;

    // Build job list for selected articles
    const newJobs: IngestionJob[] = [];
    scanResult.pages.forEach(p => {
      p.stories.forEach(s => {
        const key = storyKey(p.page_index, s.headline);
        if (selected.has(key)) {
          newJobs.push({
            id: key,
            headline: s.headline,
            page: p.page,
            page_index: p.page_index,
            status: "queued",
          });
        }
      });
    });

    setJobs(newJobs);
    setStage("ingesting");

    const user = getUser();
    const updateJob = (id: string, patch: Partial<IngestionJob>) => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
    };

    // Run requests sequentially with a small delay to avoid 429 API rate limits
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      updateJob(job.id, { status: "analyzing" });
      try {
        const res = await axios.post(`${apiUrl}/ingest-newspaper-article`, {
          session_id: scanResult.session_id,
          page_index: job.page_index,
          headline: job.headline,
        }, {
          headers: { "X-Officer-Email": user?.email || "" },
        });
        addArticles([res.data]);
        updateJob(job.id, { status: "done", article: res.data });
      } catch (err: any) {
        const msg = err.response?.data?.detail || err.message || "Analysis failed";
        updateJob(job.id, { status: "error", error: msg });
      }
      
      // Wait 1.2 seconds between calls to respect LLM API limits (RPM/TPM)
      if (i < newJobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
  };

  const doneCount = jobs.filter(j => j.status === "done").length;
  const hasAnyDone = doneCount > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 md:px-8 pt-32 md:pt-48">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 md:mb-24"
        >
          <div className="flex items-center justify-center gap-3 mb-5 text-blue-600">
            <Newspaper size={22} />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">
              Newspaper Intelligence
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-5 tracking-tighter leading-[1]">
            Scan Any Newspaper
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto text-base md:text-lg leading-relaxed">
            Upload a scanned newspaper PDF. We detect every article, you pick what matters — we handle the rest.
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-16 md:mb-20">
          {(["upload", "scanning", "checklist", "ingesting"] as Stage[]).map((s, i) => {
            const labels = ["Upload", "Scanning", "Select Stories", "Ingesting"];
            const isDone = ["upload", "scanning", "checklist", "ingesting"].indexOf(stage) > i;
            const isActive = stage === s;
            return (
              <div key={s} className="flex items-center gap-2 md:gap-3">
                <div className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" :
                  isDone ? "bg-emerald-500/15 text-emerald-500" :
                  "bg-gray-100 dark:bg-white/5 text-gray-400"
                }`}>
                  {isDone ? <Check size={10} /> : <span>{i + 1}</span>}
                  <span className="hidden sm:inline">{labels[i]}</span>
                </div>
                {i < 3 && <ChevronRight size={12} className="text-gray-300 dark:text-white/20" />}
              </div>
            );
          })}
        </div>

        {/* ── Stage: Upload ── */}
        <AnimatePresence mode="wait">
          {stage === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="max-w-2xl mx-auto"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />

              {!file ? (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`luxury-card p-16 md:p-24 flex flex-col items-center justify-center gap-6 cursor-pointer transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-600/5 shadow-xl shadow-blue-500/10"
                      : "hover:border-blue-500/40 hover:shadow-xl"
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    isDragging ? "bg-blue-600 text-white" : "bg-gray-50 dark:bg-white/5 text-gray-400"
                  }`}>
                    <Upload size={28} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-base md:text-lg mb-1">
                      {isDragging ? "Drop it here" : "Drag & drop your newspaper PDF"}
                    </p>
                    <p className="text-gray-400 text-sm">or click to browse · max 50MB</p>
                  </div>
                  <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <span className="flex items-center gap-1.5"><Layers size={11} />Scanned PDFs</span>
                    <span className="flex items-center gap-1.5"><BookOpen size={11} />Multi-page</span>
                    <span className="flex items-center gap-1.5"><Zap size={11} />Vision OCR</span>
                  </div>
                </div>
              ) : (
                <div className="luxury-card p-8 md:p-12 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 shrink-0">
                      <FileText size={26} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base md:text-lg truncate">{file.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-0.5">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB · PDF Document
                      </p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {scanError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 text-sm font-semibold flex gap-3">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      {scanError}
                    </motion.div>
                  )}

                  <button onClick={handleScan} className="main-btn w-full py-5 text-base">
                    Scan Newspaper Layout
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Stage: Scanning ── */}
          {stage === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="max-w-2xl mx-auto luxury-card p-16 md:p-24 flex flex-col items-center justify-center gap-8"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-blue-600/10 flex items-center justify-center">
                  <Newspaper size={36} className="text-blue-600" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <Loader2 size={14} className="text-white animate-spin" />
                </div>
              </div>

              <div className="text-center">
                {uploadPct < 100 ? (
                  <>
                    <p className="font-bold text-xl mb-2">Uploading Newspaper...</p>
                    <p className="text-gray-400 text-sm">Sending PDF to server for processing</p>
                  </>
                ) : scanProgress.total === 0 ? (
                  <>
                    <p className="font-bold text-xl mb-2">Rendering Pages...</p>
                    <p className="text-gray-400 text-sm">Converting PDF pages to images</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-xl mb-2">
                      Scanning Page {scanProgress.current} of {scanProgress.total}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Gemini Vision is detecting article headlines on this page...
                    </p>
                  </>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600 rounded-full"
                    animate={{
                      width: scanProgress.total > 0
                        ? `${(scanProgress.current / scanProgress.total) * 100}%`
                        : `${uploadPct}%`
                    }}
                    transition={{ type: "spring", stiffness: 60, damping: 18 }}
                  />
                </div>
                <p className="text-[10px] font-black text-center uppercase tracking-widest text-gray-400 mt-3">
                  {scanProgress.total > 0
                    ? `${scanProgress.current} / ${scanProgress.total} pages scanned`
                    : `Uploading... ${uploadPct}%`}
                </p>
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 dark:text-white/20">
                Each page takes 5–15 seconds · do not close this tab
              </p>
            </motion.div>
          )}

          {/* ── Stage: Checklist ── */}
          {stage === "checklist" && scanResult && (
            <motion.div
              key="checklist"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Summary bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-white/5">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Detected Stories</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {scanResult.total_stories} articles found across {scanResult.total_pages} pages of &ldquo;{scanResult.filename}&rdquo;
                  </p>
                </div>
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                >
                  {selected.size === scanResult.total_stories ? "Deselect All" : "Select All"}
                </button>
              </div>

              {/* Pages + stories */}
              <div className="space-y-10">
                {scanResult.pages.map(page => (
                  <div key={page.page_index}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="badge-pill-primary badge-pill text-[9px] py-1">Page {page.page}</div>
                      <div className="h-px flex-1 bg-gray-100 dark:bg-white/5" />
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {page.stories.length} {page.stories.length === 1 ? "story" : "stories"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {page.stories.map(story => {
                        const key = storyKey(page.page_index, story.headline);
                        const isChecked = selected.has(key);
                        return (
                          <motion.button
                            key={key}
                            onClick={() => toggleStory(key)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`text-left p-5 md:p-6 rounded-2xl border transition-all ${
                              isChecked
                                ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-600/10"
                                : "bg-white dark:bg-white/[0.02] border-gray-100 dark:border-white/10 hover:border-blue-500/30"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                isChecked ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-white/20"
                              }`}>
                                {isChecked && <Check size={11} className="text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-bold text-sm leading-snug mb-2 ${isChecked ? "text-blue-700 dark:text-blue-400" : ""}`}>
                                  {story.headline}
                                </p>
                                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">
                                  {story.excerpt}
                                </p>
                                <div className="flex items-center gap-3">
                                  {story.category && (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                                      isChecked
                                        ? "bg-blue-200/50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                        : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
                                    }`}>
                                      {story.category}
                                    </span>
                                  )}
                                  {story.relevance_score !== undefined && (
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                                      story.relevance_score >= 80 ? "text-emerald-500" :
                                      story.relevance_score >= 60 ? "text-blue-500" : "text-amber-500"
                                    }`}>
                                      {story.relevance_score}% Rel
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky action bar */}
              <div className="sticky bottom-6 flex justify-center mt-8">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white dark:bg-[#0f0f11] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 px-6 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-8"
                >
                  {isAlreadyIngested ? (
                    <div className="text-center sm:text-left">
                      <p className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Sparkles size={14} className="animate-pulse" /> Already Ingested Edition
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        These articles are already analyzed and synced in the cloud.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center sm:text-left">
                      <p className="font-bold text-sm">
                        {selected.size === 0
                          ? "No articles selected"
                          : `${selected.size} ${selected.size === 1 ? "article" : "articles"} selected`}
                      </p>
                      {selected.size > 0 && (
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          ~{selected.size * 15}–{selected.size * 25}s estimated
                        </p>
                      )}
                    </div>
                  )}
                  {isAlreadyIngested ? (
                    <button
                      onClick={() => {
                        localStorage.setItem("active_feed_tab", "newspapers");
                        router.push("/");
                      }}
                      className="py-3 px-8 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all border border-amber-400/20"
                    >
                      View Ingested Edition
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleIngest}
                      disabled={selected.size === 0}
                      className="main-btn py-3 px-8 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
                    >
                      Analyze Selected ({selected.size})
                      <ArrowRight size={16} />
                    </button>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── Stage: Ingesting ── */}
          {stage === "ingesting" && (
            <motion.div
              key="ingesting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Ingesting Intelligence</h2>
                <p className="text-gray-400 text-sm">
                  {doneCount} of {jobs.length} articles complete · Articles are being analyzed in parallel
                </p>
              </div>

              <div className="space-y-4">
                {jobs.map(job => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`luxury-card p-5 md:p-6 flex items-center gap-5 transition-all ${
                      job.status === "done" ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5" :
                      job.status === "error" ? "border-red-500/30 bg-red-50/30 dark:bg-red-500/5" :
                      job.status === "analyzing" ? "border-blue-500/30" : ""
                    }`}
                  >
                    {/* Status icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      job.status === "done" ? "bg-emerald-500/15 text-emerald-500" :
                      job.status === "error" ? "bg-red-500/15 text-red-500" :
                      job.status === "analyzing" ? "bg-blue-600/15 text-blue-600" :
                      "bg-gray-100 dark:bg-white/5 text-gray-400"
                    }`}>
                      {job.status === "done" && <CheckCircle2 size={20} />}
                      {job.status === "error" && <AlertCircle size={20} />}
                      {job.status === "analyzing" && <Loader2 size={20} className="animate-spin" />}
                      {job.status === "queued" && <Clock size={20} />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-snug truncate">
                        {job.article?.title || job.headline}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                          Page {job.page}
                        </span>
                        {job.article?.category && (
                          <>
                            <span className="text-gray-200 dark:text-white/10">·</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                              {job.article.category}
                            </span>
                          </>
                        )}
                        {job.article?.relevance_score !== undefined && (
                          <>
                            <span className="text-gray-200 dark:text-white/10">·</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              {job.article.relevance_score}% Relevant
                            </span>
                          </>
                        )}
                      </div>
                      {job.error && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1 truncate">{job.error}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shrink-0 ${
                      job.status === "done" ? "bg-emerald-500/15 text-emerald-600" :
                      job.status === "error" ? "bg-red-500/15 text-red-500" :
                      job.status === "analyzing" ? "bg-blue-500/15 text-blue-600" :
                      "bg-gray-100 dark:bg-white/10 text-gray-400"
                    }`}>
                      {job.status === "queued" ? "Queued" :
                       job.status === "analyzing" ? "Analyzing..." :
                       job.status === "done" ? "Ingested ✓" : "Failed"}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* CTA once at least one is done */}
              <AnimatePresence>
                {hasAnyDone && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                  >
                    <button onClick={() => router.push("/")} className="main-btn py-4 px-10">
                      View Intelligence Feed
                      <ArrowRight size={18} />
                    </button>
                    <button
                      onClick={() => { setStage("upload"); setFile(null); setScanResult(null); setJobs([]); }}
                      className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      Scan Another Newspaper
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
