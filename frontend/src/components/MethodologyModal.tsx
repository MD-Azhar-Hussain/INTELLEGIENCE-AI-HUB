"use client";

import { motion } from "framer-motion";
import { X, BrainCircuit, Target, Zap, CheckCircle2, ChevronRight, Fingerprint, ScanText, BookOpen, CloudUpload, Database } from "lucide-react";

interface MethodologyModalProps {
  onClose: () => void;
}

export default function MethodologyModal({ onClose }: MethodologyModalProps) {
  const steps = [
    {
      icon: <ScanText size={24} />,
      title: "Multi-Source Ingestion",
      desc: "Three powerful intake modes in one platform: upload full PDF documents, run live Newspaper OCR to scan physical pages article-by-article, or ingest curated article metadata directly — all routed through the same processing pipeline.",
      color: "blue"
    },
    {
      icon: <BrainCircuit size={24} />,
      title: "Intelligence Synthesis",
      desc: "Each article is processed through a UPSC-tuned AI engine that extracts the core Issue, multi-dimensional Arguments, strategic Way Forward, and a concise UPSC-ready summary — ready for revision in seconds.",
      color: "purple"
    },
    {
      icon: <BookOpen size={24} />,
      title: "GS Syllabus Mapping",
      desc: "Every intelligence unit is automatically tagged to its exact UPSC General Studies sub-topic (e.g. GS-III: Infrastructure: Energy, GS-II: Polity: Federalism). No manual tagging — the AI does it for you.",
      color: "rose"
    },
    {
      icon: <Target size={24} />,
      title: "Pattern Recognition & Clustering",
      desc: "Related articles are detected and grouped into thematic 'Decks' and 'Newspaper Clusters', letting you rapidly cross-reference policy shifts, compare editorial angles, and build interconnected mental models.",
      color: "emerald"
    },
    {
      icon: <Zap size={24} />,
      title: "Tactical Evaluation",
      desc: "The platform generates high-yield Prelims MCQs and Mains questions from your ingested articles, then evaluates your answers against official UPSC marking standards — closing the loop from input to output.",
      color: "amber"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      className="w-full max-w-5xl bg-white dark:bg-[#0a0a0b] rounded-[3rem] shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col md:flex-row"
    >
      {/* Sidebar - Quick Stats */}
      <div className="w-full md:w-80 bg-gray-50 dark:bg-white/[0.02] p-8 flex flex-col border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/5 shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-600/20">
          <Fingerprint size={24} />
        </div>
        <h3 className="text-2xl font-black mb-2 tracking-tight uppercase">Strategic Protocol</h3>
        <p className="text-xs text-gray-400 font-bold mb-10 uppercase tracking-widest leading-relaxed">
          Version 2.4.0 <br />
          Enterprise Intelligence
        </p>

        <div className="space-y-5 hidden md:block mt-auto">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">5-Stage AI Pipeline</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">GS I · II · III · IV Coverage</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cloud Sync · Officer Profiles</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 md:p-12 relative overflow-y-auto max-h-[88vh]">
        <button 
          onClick={onClose}
          className="absolute top-10 right-10 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tighter">The Methodology.</h2>
          <p className="text-base text-gray-500 dark:text-gray-400 font-medium mb-8 leading-relaxed">
            How we transform raw noise into high-yield strategic intelligence for the civil services.
          </p>

          <div className="space-y-8">
            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-8 group"
              >
                <div className={`w-14 h-14 rounded-2xl shrink-0 border border-gray-100 dark:border-white/5 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg
                  ${step.color === 'blue' ? 'text-blue-500 bg-blue-500/5' : 
                    step.color === 'purple' ? 'text-purple-500 bg-purple-500/5' :
                    step.color === 'rose' ? 'text-rose-500 bg-rose-500/5' :
                    step.color === 'emerald' ? 'text-emerald-500 bg-emerald-500/5' :
                    'text-amber-500 bg-amber-500/5'}
                `}>
                  {step.icon}
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2 tracking-tight flex items-center gap-3">
                    {step.title}
                    <ChevronRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h4>
                  <p className="text-sm font-medium text-gray-400 leading-relaxed max-w-lg">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-10 p-6 rounded-3xl bg-blue-600 text-white flex items-center justify-between shadow-2xl shadow-blue-600/20">
          <div>
            <h5 className="font-black uppercase tracking-widest text-[10px] mb-2 opacity-60">System Status</h5>
            <p className="text-xl font-bold">Operational Accuracy: 99.4%</p>
          </div>
          <CheckCircle2 size={32} className="opacity-40" />
        </div>
      </div>
    </motion.div>
  );
}
