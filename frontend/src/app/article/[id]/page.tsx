"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Article, getArticleById } from "@/lib/store";
import Navbar from "@/components/Navbar";
import {
  ArrowLeft, BookOpen, Clock, Target, Users,
  MessageSquare, FastForward, CheckCircle2,
  BrainCircuit, Layout, HelpCircle, Sparkles,
  Command, Fingerprint, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ArticleDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [activeTab, setActiveTab] = useState<"analysis" | "mcqs" | "mains">("analysis");

  useEffect(() => {
    if (id) {
      const found = getArticleById(id as string);
      if (found) setArticle(found);
      else router.push("/");
    }
  }, [id, router]);

  if (!article) return <div className="min-h-screen bg-[var(--bg-primary)]" />;

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen pb-20 selection:bg-blue-100 selection:text-blue-700">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 md:px-8 pt-32 md:pt-40">
        {/* Navigation */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors mb-10 md:mb-16 font-bold text-[10px] md:text-xs uppercase tracking-widest group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Unit Feed
        </button>

        {/* Header Section */}
        <div className="mb-16 md:mb-24">
          <div className="flex flex-wrap items-center gap-3 mb-8 md:mb-10">
            <span className="badge-pill badge-pill-primary">{article.category}</span>
            <span className="badge-pill">{article.gs_paper}</span>
            <div className="flex items-center gap-1.5 sm:ml-auto text-emerald-600">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{article.relevance_score}% Relevance</span>
            </div>
          </div>

          <h1 className="text-3xl md:text-6xl font-bold mb-8 md:mb-10 tracking-tight leading-[1.2] md:leading-[1.05] text-[var(--text-primary)]">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-100 dark:border-white/5 pt-6 md:pt-8">
            <div className="flex items-center gap-2">
              <Clock size={12} />
              {new Date(article.ingested_at).toLocaleDateString()}
            </div>
            {article.source && (
              <div className="flex items-center gap-2">
                <Command size={12} />
                <span className="truncate max-w-[100px] md:max-w-none">{article.source}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Layers size={12} />
              Ref: {article.id.slice(0, 8)}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1 md:gap-2 p-1 md:p-1.5 bg-gray-50 dark:bg-white/[0.03] rounded-xl md:rounded-2xl mb-12 md:mb-20 border border-gray-100 dark:border-white/10 sticky top-24 md:top-28 z-40 backdrop-blur-xl">
          <TabButton
            active={activeTab === "analysis"}
            onClick={() => setActiveTab("analysis")}
            icon={<Layout size={18} />}
            label="Analysis"
          />
          <TabButton
            active={activeTab === "mcqs"}
            onClick={() => setActiveTab("mcqs")}
            icon={<BrainCircuit size={18} />}
            label="Quiz"
          />
          <TabButton
            active={activeTab === "mains"}
            onClick={() => setActiveTab("mains")}
            icon={<MessageSquare size={18} />}
            label="Pattern"
          />
        </div>

        {/* Content Flow */}
        <AnimatePresence mode="wait">
          {activeTab === "analysis" && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-20"
            >
              {/* Executive Insights */}
              <section>
                <div className="flex items-center gap-3 mb-6 md:mb-10">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 size={18} className="md:w-5 md:h-5" />
                  </div>
                  <h2 className="text-lg md:text-xl font-bold tracking-tight uppercase tracking-[0.1em] text-gray-400">Executive Summary</h2>
                </div>

                <div className="space-y-4">
                  {article.summary.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-6 md:p-8 luxury-card hover:bg-gray-50/50 transition-colors"
                    >
                      <p className="text-base md:text-lg font-semibold leading-relaxed opacity-90">{point}</p>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Contextual Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <section className="p-8 md:p-10 luxury-card bg-blue-50/20 dark:bg-blue-600/[0.02]">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4 md:mb-6 flex items-center gap-2">
                    <Fingerprint size={14} /> The Core Issue
                  </h3>
                  <p className="text-sm md:text-gray-600 dark:text-gray-400 leading-relaxed font-semibold">{article.issue_overview}</p>
                </section>
                <section className="p-8 md:p-10 luxury-card bg-purple-50/20 dark:bg-purple-600/[0.02]">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-4 md:mb-6 flex items-center gap-2">
                    <Clock size={14} /> Contextual Background
                  </h3>
                  <p className="text-sm md:text-gray-600 dark:text-gray-400 leading-relaxed font-semibold">{article.background}</p>
                </section>
              </div>

              {/* Arguments Redesign */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <ArgBlock title="Strategic Merits" items={article.arguments_for} icon="✓" color="emerald" />
                <ArgBlock title="Critical Risks" items={article.arguments_against} icon="✕" color="red" />
              </div>

              {/* Way Forward Blue */}
              <section className="p-8 md:p-12 rounded-[30px] md:rounded-[40px] bg-gray-900 dark:bg-blue-600 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-10 hidden md:block">
                  <FastForward size={140} />
                </div>
                <div className="relative z-10">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 md:mb-10 opacity-60">Strategic Pathway</h2>
                  <div className="space-y-6 md:space-y-8">
                    {article.way_forward.map((point, i) => (
                      <div key={i} className="flex gap-4 md:gap-6 items-start">
                        <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-white mt-1.5 md:mt-3 shrink-0" />
                        <p className="text-base md:text-xl font-bold leading-relaxed">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === "mcqs" && (
            <motion.div
              key="mcqs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {article.mcqs.map((mcq, i) => (
                <MCQCard key={i} mcq={mcq} index={i} />
              ))}
            </motion.div>
          )}

          {activeTab === "mains" && (
            <motion.div
              key="mains"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {article.mains_questions.map((q, i) => (
                <MainsCard key={i} question={q} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-xl transition-all ${active
          ? 'bg-white dark:bg-white/10 text-blue-600 shadow-sm border border-gray-100 dark:border-white/20'
          : 'text-gray-400 hover:text-gray-600'
        }`}
    >
      <span className={active ? 'text-blue-600' : 'text-gray-300'}>{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ArgBlock({ title, items, icon, color }: any) {
  const isGreen = color === 'emerald';
  return (
    <div className={`p-10 luxury-card ${isGreen ? 'bg-emerald-50/10' : 'bg-red-50/10'}`}>
      <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-10 ${isGreen ? 'text-emerald-700' : 'text-red-700'}`}>{title}</h3>
      <div className="space-y-6">
        {items.map((item: string, i: number) => (
          <div key={i} className="flex gap-4">
            <span className={`text-xs font-black ${isGreen ? 'text-emerald-500' : 'text-red-500'}`}>{icon}</span>
            <p className="text-[14px] font-bold leading-relaxed opacity-80">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MCQCard({ mcq, index }: any) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="luxury-card p-12 lg:p-16">
      <div className="flex justify-between items-center mb-10">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prelims Pattern #{index + 1}</span>
        {selected && (
          <span className={`text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest ${selected === mcq.answer ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            {selected === mcq.answer ? 'Validated' : 'Requires Review'}
          </span>
        )}
      </div>
      <h3 className="text-2xl lg:text-3xl font-bold mb-14 tracking-tight leading-tight">{mcq.question}</h3>
      <div className="grid gap-4 mb-10">
        {mcq.options.map((opt: string) => {
          const isSelected = selected === opt;
          const isCorrect = opt === mcq.answer;
          return (
            <button
              key={opt}
              disabled={!!selected}
              onClick={() => setSelected(opt)}
              className={`p-6 rounded-2xl border-2 text-left transition-all font-bold text-sm ${isSelected
                  ? (isCorrect ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50')
                  : 'border-gray-50 hover:border-blue-600 bg-gray-50/50'
                }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MainsCard({ question, index }: any) {
  const [show, setShow] = useState(false);
  return (
    <div className="luxury-card p-12 lg:p-16">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-8">Mains Structure #{index + 1}</span>
      <h3 className="text-3xl font-bold mb-12 italic leading-tight">"{question.question}"</h3>
      <button onClick={() => setShow(!show)} className="main-btn w-full mb-10">
        {show ? "Collapse Strategy" : "Examine Answer Strategy"}
      </button>
      {show && (
        <div className="space-y-12">
          <DetailItem title="Phase I: Perspective & Introduction" content={question.model_answer.introduction} />
          <DetailItem title="Phase II: Critical Narrative & Body" content={question.model_answer.body} />
          <DetailItem title="Phase III: Policy Synthesis & Conclusion" content={question.model_answer.conclusion} />
        </div>
      )}
    </div>
  );
}

function DetailItem({ title, content }: any) {
  return (
    <div className="border-t border-gray-100 pt-8">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4">{title}</h4>
      <p className="text-[15px] font-semibold leading-relaxed text-gray-500">{content}</p>
    </div>
  );
}
