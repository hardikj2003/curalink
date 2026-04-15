import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarInput } from "./components/SidebarInput";
import { PipelineStep } from "./components/PipelineStep";
import { ChatMessage } from "./components/ChatMessage";
import {
  Activity,
  Microscope,
  User,
  Loader2,
  GraduationCap,
  Stethoscope,
  MapPin,
  Database,
  Filter,
  Sparkles,
} from "lucide-react";

// --- Main Application ---
const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState({
    patientName: "",
    disease: "",
    location: "",
  });
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState({ step: 0 }); 
  const [sessionId] = useState(`session_${Date.now()}`);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!input || !context.disease) return;

    const userQuery = input;
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
    setLoading(true);
    setInput("");

    try {
      // Step 1: Initialize Fetching
      setPipeline({ step: 1 });

      const response = await axios.post(
        "https://curalink-backend-xbfz.onrender.com/api/research/search",
        {
          ...context,
          query: userQuery,
          sessionId: sessionId,
        },
      );

      // Step 2: Transition to Ranking
      setPipeline({ step: 2 });
      await new Promise((r) => setTimeout(r, 1000)); 

      // Step 3: Transition to AI Synthesis
      setPipeline({ step: 3 });
      await new Promise((r) => setTimeout(r, 1000));

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.data,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "**System Error:** Connection to research engine failed.",
        },
      ]);
    } finally {
      setLoading(false);
      setPipeline({ step: 0 });
    }
  };

  return (
    <div className="flex h-screen bg-[#fcfdfe] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-2xl z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 text-blue-600 font-black text-2xl tracking-tighter hover:scale-105 transition-transform cursor-default">
            <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-lg shadow-blue-200">
              <Activity size={24} />
            </div>
            <span>CuraLink</span>
          </div>
        </div>

        <div className="flex-1 px-6 space-y-8 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Patient Context
            </label>
            <div className="space-y-3">
              <SidebarInput
                icon={<User size={16} />}
                placeholder="Patient Name"
                value={context.patientName}
                onChange={(v) => setContext({ ...context, patientName: v })}
              />
              <SidebarInput
                icon={<Stethoscope size={16} />}
                placeholder="Primary Condition"
                value={context.disease}
                onChange={(v) => setContext({ ...context, disease: v })}
              />
              <SidebarInput
                icon={<MapPin size={16} />}
                placeholder="Location (e.g. Toronto, CA)"
                value={context.location}
                onChange={(v) => setContext({ ...context, location: v })}
              />
            </div>
          </div>

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-6 bg-slate-50 rounded-4xl border border-slate-100 space-y-5 shadow-inner overflow-hidden"
              >
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Intelligence Pipeline
                </h4>
                <PipelineStep
                  active={pipeline.step === 1}
                  completed={pipeline.step > 1}
                  label="Cross-API Deep Search"
                  icon={<Database size={14} />}
                />
                <PipelineStep
                  active={pipeline.step === 2}
                  completed={pipeline.step > 2}
                  label="Re-Ranking & Precision"
                  icon={<Filter size={14} />}
                />
                <PipelineStep
                  active={pipeline.step === 3}
                  completed={pipeline.step > 3}
                  label="Custom LLM Synthesis"
                  icon={<Sparkles size={14} />}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6 bg-blue-600 rounded-4xl text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 font-bold text-xs mb-2">
                <GraduationCap size={14} /> <span>Evidence Protocol</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed font-medium">
                Our RAG engine prioritizes Evidence-Based Medicine from
                OpenAlex, PubMed, and ClinicalTrials.gov.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <Microscope size={80} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-[#fcfdfe]">
        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-12 space-y-8 scroll-smooth">
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto"
              >
                <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-8 text-blue-600 border border-slate-50">
                  <Microscope size={48} />
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">
                  CuraLink Intelligence
                </h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                  Initialize the patient context to begin deep retrieval and
                  medical synthesis.
                </p>
              </motion.div>
            ) : (
              <div className="max-w-4xl mx-auto w-full">
                {messages.map((m, i) => (
                  <ChatMessage key={i} message={m} />
                ))}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start mb-12"
                  >
                    <div className="flex items-center gap-3 bg-white p-4 px-6 rounded-full shadow-sm border border-slate-100 text-blue-600 font-bold text-xs italic">
                      <Loader2 className="animate-spin" size={16} /> CuraLink is
                      processing datasets...
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
          <div ref={scrollRef} />
        </div>

        {/* Action Bar */}
        <div className="px-6 py-8 bg-linear-to-t from-white via-white to-transparent z-10">
          <form onSubmit={handleSearch} className="max-w-4xl mx-auto group">
            <div className="flex items-center bg-white rounded-4xl p-2 shadow-2xl border border-slate-100 group-focus-within:border-blue-300 group-focus-within:ring-4 group-focus-within:ring-blue-50/50 transition-all duration-300">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about treatments, drug side effects, or clinical trials..."
                className="flex-1 p-5 bg-transparent border-none focus:ring-0 text-sm font-semibold outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white h-14 px-10 rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 font-black text-xs tracking-widest uppercase shadow-lg shadow-blue-200 disabled:bg-slate-200 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default App;
