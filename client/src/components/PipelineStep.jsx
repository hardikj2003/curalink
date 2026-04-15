import { CheckCircle2 } from "lucide-react";

export const PipelineStep = ({ active, completed, label, icon }) => (
  <div
    className={`flex items-center gap-3 transition-all duration-500 ${active || completed ? "opacity-100" : "opacity-30"}`}
  >
    <div
      className={`${completed ? "text-green-500" : active ? "text-blue-600 animate-pulse" : "text-slate-400"}`}
    >
      {completed ? <CheckCircle2 size={16} /> : icon}
    </div>
    <span
      className={`text-[11px] font-bold ${active ? "text-blue-700" : "text-slate-600"}`}
    >
      {label}
    </span>
  </div>
);
