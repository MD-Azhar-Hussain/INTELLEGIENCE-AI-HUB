"use client";

import { motion } from "framer-motion";
import { X, BrainCircuit, Target, Shield, Zap, CheckCircle2, ChevronRight, Fingerprint, Layers, ScanText, FileText } from "lucide-react";

interface MethodologyModalProps {
  onClose: () => void;
}

export default function MethodologyModal({ onClose }: MethodologyModalProps) {
  const steps = [
    {
      icon: <ScanText size={24} />,
      title: "Contextual Ingestion",
      desc: "Our engine performs a deep-scan of the source document, identifying entities, historical context, and policy relevance using multi-modal AI processing.",
      color: "blue"
    },
    {
      icon: <BrainCircuit size={24} />,
      title: "Intelligence Synthesis",
      desc: "The raw data is funneled through specialized UPSC-tuned neural layers to extract core issues, arguments, and strategic 'Way Forward' pathways.",
      color: "purple"
    },
    {
      icon: <Target size={24} />,
      title: "Pattern Recognition",
      desc: "Related intelligence units are detected and clustered into thematic 'Decks', allowing for rapid cross-referencing of complex policy shifts.",
      color: "emerald"
    },
    {
      icon: <Zap size={24} />,
      title: "Tactical Evaluation",
      desc: "AI generates high-yield MCQs and Mains questions, then evaluates your answers with the same rigor as an official UPSC evaluator.",
      color: "amber"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      className="w-full max-w-5xl bg-white dark:bg-[#0a0a0b] rounded-[3rem] shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col md:flex-row h-[85vh] md:h-auto"
    >
      {/* Sidebar - Quick Stats */}
      <div className="w-full md:w-80 bg-gray-50 dark:bg-white/[0.02] p-10 flex flex-col border-r border-gray-100 dark:border-white/5">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-8 shadow-xl shadow-blue-600/20">
          <Fingerprint size={24} />
        </div>
        <h3 className="text-2xl font-black mb-2 tracking-tight uppercase">Strategic Protocol</h3>
        <p className="text-xs text-gray-400 font-bold mb-12 uppercase tracking-widest leading-relaxed">
          Version 2.4.0 <br />
          Enterprise Intelligence
        </p>

        <div className="space-y-8 mt-auto hidden md:block">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gemini 2.0 Integration</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Neutral Policy Engine</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10 md:p-16 relative overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-10 right-10 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tighter">The Methodology.</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 font-medium mb-16 leading-relaxed">
            How we transform raw noise into high-yield strategic intelligence for the civil services.
          </p>

          <div className="space-y-12">
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

        <div className="mt-20 p-8 rounded-3xl bg-blue-600 text-white flex items-center justify-between shadow-2xl shadow-blue-600/20">
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
