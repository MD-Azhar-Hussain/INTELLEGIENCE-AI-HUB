"use client";

import { useState } from "react";
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileText, Fingerprint } from "lucide-react";
import axios from "axios";
import { getUser } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function UploadModal({ onUploadSuccess }: { onUploadSuccess: (data: any[], filename: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const user = getUser();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";
      const response = await axios.post(`${apiUrl}/upload`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "X-Officer-Email": user?.email || ""
        },
      });

      const data = response.data;
      if (data.articles) {
        setStatus("success");
        setTimeout(() => onUploadSuccess(data.articles, file.name), 1000);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setError(err.response?.data?.detail || err.message || "Upload failed. Is the backend running?");
    }
  };

  return (
    <div className="bg-white dark:bg-[#111112] rounded-[30px] md:rounded-[40px] p-8 md:p-16 border-2 border-gray-100 dark:border-white/5 shadow-2xl relative overflow-hidden">
      <div className="mb-10 md:mb-14">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6 md:mb-8 border border-gray-100 dark:border-white/10">
          <Fingerprint size={24} className="text-gray-400 md:w-7 md:h-7" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold mb-3 md:mb-4 tracking-tight uppercase">Complete Summarizer</h2>
        <p className="text-gray-500 font-medium leading-relaxed max-w-sm text-sm md:text-base">Upload a newspaper PDF to analyze and summarize the entire document at once.</p>
      </div>

      <div className="space-y-8 md:space-y-10">
        {!file ? (
          <div className="group relative">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              accept=".pdf"
            />
            <div className="border-2 border-dashed border-gray-100 dark:border-white/10 rounded-2xl md:rounded-3xl py-16 md:py-24 flex flex-col items-center justify-center gap-3 md:gap-4 hover:border-blue-600 hover:bg-blue-50 transition-all">
              <Upload size={28} className="text-gray-300 group-hover:text-blue-600 transition-colors md:w-8 md:h-8" />
              <p className="font-bold text-gray-400 group-hover:text-blue-600 transition-colors text-sm md:text-base">Select Newspaper PDF</p>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-8 rounded-2xl md:rounded-3xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-5">
              <div className="h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center text-blue-600 shadow-sm border border-gray-100 dark:border-white/10">
                <FileText size={20} className="md:w-7 md:h-7" />
              </div>
              <div className="max-w-[120px] sm:max-w-none">
                <p className="font-bold text-sm md:text-lg leading-none mb-1 truncate">{file.name}</p>
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setStatus("idle"); }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {status === "error" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] md:text-sm font-bold flex gap-3">
            <AlertCircle size={18} className="shrink-0" />
            <span className="leading-tight">{error}</span>
          </motion.div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || status === "uploading" || status === "processing" || status === "success"}
          className="main-btn w-full py-5 md:py-6 text-lg md:text-xl disabled:opacity-50 disabled:grayscale"
        >
          {status === "uploading" || status === "processing" ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm md:text-lg">Summarizing Newspaper...</span>
            </>
          ) : (
            <span className="text-sm md:text-lg">Summarize Entire Paper →</span>
          )}
        </button>

        <div className="text-center pt-2">
          <Link
            href="/newspaper"
            className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
          >
            Use Page-by-Page Scanner instead →
          </Link>
        </div>
      </div>
    </div>
  );
}
