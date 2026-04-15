import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import {
  Activity,
  Sparkles,
  ExternalLinkIcon,
  BookOpen,
  Microscope,
  ClipboardCheck,
  ChevronRight,
  Info,
} from "lucide-react";

const normalizeLabel = (text) => {
  let clean = text.replace(/\*/g, "").trim();

  // Fix missing colon
  if (
    ["title", "authors", "year", "platform", "url", "supporting snippet"].some(
      (k) => clean.toLowerCase().startsWith(k),
    ) &&
    !clean.endsWith(":")
  ) {
    clean = clean + ":";
  }
  return clean;
};

const getLabelIcon = (labelName) => {
  if (!labelName) return <Info size={12} />;
  const name = labelName.toLowerCase();
  if (name.includes("author") || name.includes("contact"))
    return <Info size={12} />;
  if (name.includes("title")) return <BookOpen size={12} />;
  if (name.includes("year")) return <Activity size={12} />;
  if (name.includes("url") || name.includes("platform"))
    return <ExternalLinkIcon size={12} />;
  if (name.includes("finding") || name.includes("evidence"))
    return <Microscope size={12} />;
  if (
    name.includes("trial") ||
    name.includes("status") ||
    name.includes("eligibility") ||
    name.includes("location") ||
    name.includes("relevance")
  )
    return <ClipboardCheck size={12} />;
  return <Sparkles size={12} />;
};

const cleanContent = (text) => {
  return text
    .replace(/\(not provided\)/gi, "Not available in provided data")
    .replace(/not provided/gi, "Not available in provided data");
};

export const ChatMessage = ({ message }) => {
  const isUser = message.role === "user";
  const cleanedContent = cleanContent(message.content || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} w-full mb-8`}
    >
      <div
        className={`${isUser ? "max-w-md" : "w-full max-w-[95%] lg:max-w-[85%]"}`}
      >
        {isUser ? (
          <div className="bg-blue-600 text-white p-3 px-5 rounded-2xl rounded-tr-none shadow-md">
            <p className="text-sm font-medium leading-relaxed">
              {cleanedContent}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-4xl overflow-hidden shadow-sm border-b-[6px] border-b-blue-600">
            {/* Header */}
            <div className="bg-slate-50/80 px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-sm">
                  <Activity size={16} className="stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-black tracking-[0.2em] text-slate-800 uppercase">
                  CuraLink Medical Analysis
                </span>
              </div>
            </div>

            <div className="p-6 md:p-10">
              <ReactMarkdown
                components={{
                  // Section headers (h2)
                  h2: ({ children }) => {
                    const text = children.toString().toLowerCase();
                    let Icon = BookOpen;
                    if (text.includes("insight")) Icon = Microscope;
                    if (text.includes("trial")) Icon = ClipboardCheck;
                    return (
                      <div className="flex flex-col gap-2 mt-10 mb-6 first:mt-0 group">
                        <div className="flex items-center gap-2 text-blue-600">
                          <Icon size={22} className="stroke-[2.5]" />
                          <div className="h-0.5 w-10 bg-blue-100 rounded-full" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                          {children}
                        </h2>
                      </div>
                    );
                  },
                  // Sub headers (h3)
                  h3: ({ children }) => (
                    <h3 className="text-lg font-extrabold text-blue-900 mt-8 mb-4 flex items-start gap-2 leading-tight">
                      <ChevronRight
                        className="mt-1 text-blue-500 shrink-0"
                        size={18}
                      />
                      {children}
                    </h3>
                  ),
                  // Paragraphs
                  p: ({ children }) => {
                    const text = children?.toString().trim() || "";
                    if (
                      text === "" ||
                      text === ":" ||
                      text === "Not provided" ||
                      text === "(not provided)"
                    ) {
                      return null;
                    }
                    return (
                      <p className="text-slate-600 text-[15px] leading-relaxed mb-5 font-medium">
                        {children}
                      </p>
                    );
                  },
                  // Lists (ul)
                  ul: ({ children }) => (
                    <ul className="space-y-4 mb-8">{children}</ul>
                  ),
                  // List items (li) – card style
                  li: ({ children }) => (
                    <li className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl list-none transition-all hover:bg-white hover:border-blue-100 hover:shadow-md">
                      <div className="text-slate-700 text-[14.5px] leading-[1.6]">
                        {children}
                      </div>
                    </li>
                  ),
                  // Bold text (used for labels like "Title:", "Authors:", etc.)
                  strong: ({ children }) => {
                    let content = children.toString();
                    const cleanText = normalizeLabel(content);
                    const isLabel = cleanText.endsWith(":");

                    if (isLabel && cleanText.length < 3) return null;

                    if (isLabel) {
                      const labelName = cleanText.replace(":", "");
                      return (
                        <span className="block mt-4 first:mt-0 mb-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 shadow-sm">
                            {getLabelIcon(labelName)}
                            {labelName}
                          </span>
                        </span>
                      );
                    }
                    return (
                      <strong className="text-slate-900 font-black text-[15px]">
                        {children}
                      </strong>
                    );
                  },
                  // Links (a)
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 font-bold hover:text-blue-800 underline decoration-blue-200 underline-offset-4 decoration-2 transition-all break-all"
                    >
                      {children}
                      <ExternalLinkIcon size={13} />
                    </a>
                  ),
                }}
              >
                {cleanedContent}
              </ReactMarkdown>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-600 uppercase">
                CuraLink AI Assistance
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
