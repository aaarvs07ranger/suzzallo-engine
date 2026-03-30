"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Library, Paperclip, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleVisualizer from "@/components/ScheduleVisualizer";

type Message = {
  role: "user" | "agent";
  content: string;
};

export default function SuzzalloChat() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", content: "Welcome to Suzzallo. Upload your unofficial transcript to get started, or just tell me what you want to take." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [studentContext, setStudentContext] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Dynamic Loading Steps ---
  const loadingSteps = [
    "Analyzing course constraints...",
    "Querying UW Time Schedule...",
    "Cross-referencing RateMyProfessors...",
    "Calculating non-overlapping permutations...",
    "Finalizing optimal schedule..."
  ];
  const [loadingStep, setLoadingStep] = useState(0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Cycle through loading steps
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setLoadingStep(0);
    }
  }, [isLoading]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: `Uploaded document: ${file.name}` }]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("https://suzzallo-engine.onrender.com/analyze-transcript", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setStudentContext(data); 
      
      setMessages(prev => [...prev, { 
        role: "agent", 
        content: `**Transcript Processed!** \n\nI see you are currently ${data.major}. You've completed ${data.completed_courses?.length || 0} classes. What do you want to plan for next quarter?` 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "agent", content: "Error parsing transcript. Is the Python backend running?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;

    const newMessages = [...messages, { role: "user" as const, content: prompt }];
    setMessages(newMessages);
    setPrompt("");
    setIsLoading(true);

    try {
      const response = await fetch("https://suzzallo-engine.onrender.com/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt, student_context: studentContext }),
      });

      const data = await response.json();
      setMessages([...newMessages, { role: "agent", content: data.agent_response }]);
    } catch (error) {
      setMessages([...newMessages, { role: "agent", content: "Error connecting to the Suzzallo Engine." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border-slate-800 bg-slate-900 overflow-hidden">
        
        {/* Header */}
        <CardHeader className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
              <Library className="text-indigo-400 h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-100 tracking-tight">Suzzallo</CardTitle>
              <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">UW Seattle Strategy Engine</p>
            </div>
          </div>
          
          {/* Status Indicator */}
          {studentContext && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-xs font-semibold shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              Transcript Synced
            </div>
          )}
        </CardHeader>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-950/50 scroll-smooth">
          <div className="flex flex-col gap-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "agent" && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 mt-1 shadow-sm">
                    <Bot className="h-4 w-4 text-indigo-400" />
                  </div>
                )}
                
                <div className={`px-5 py-4 rounded-2xl max-w-[85%] shadow-sm prose prose-sm max-w-none ${
                  msg.role === "user" 
                    ? "bg-indigo-600 text-white rounded-br-none prose-invert shadow-indigo-900/20" 
                    : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none prose-invert"
                }`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  
                  {/* INJECT THE CALENDAR IF AI SAYS SO */}
                  {msg.role === "agent" && msg.content.includes("Here is a potential schedule") && (
                    <div className="mt-4">
                      <ScheduleVisualizer />
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 mt-1 shadow-sm">
                    <User className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
            
            {/* The Animated Thinking Visualizer */}
            {isLoading && (
              <div className="flex gap-4 justify-start mb-4">
                 <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 mt-1 shadow-sm">
                    <Bot className="h-4 w-4 text-indigo-400 animate-pulse" />
                  </div>
                <div className="px-5 py-4 rounded-2xl bg-slate-800 border border-slate-700 rounded-bl-none shadow-sm min-w-[300px]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <span className="font-semibold text-slate-200 text-sm tracking-tight">Engine Active</span>
                  </div>
                  <div className="h-5 overflow-hidden relative">
                    <AnimatePresence mode="popLayout">
                      <motion.div 
                        key={loadingStep}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="text-indigo-400 font-medium text-xs absolute w-full"
                      >
                        {loadingSteps[loadingStep]}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3 items-center max-w-4xl mx-auto"
          >
            {/* Hidden File Input */}
            <input 
              type="file" 
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Upload Button */}
            <Button 
              type="button" 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-14 w-14 rounded-xl border-slate-700 bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 hover:border-indigo-500/50 transition-all shadow-sm"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type your constraints (e.g., 'Find me a light schedule with no Friday classes')..." 
              className="flex-1 border-slate-700 bg-slate-800 text-slate-200 placeholder:text-slate-500 focus-visible:ring-indigo-500 shadow-sm text-base h-14 rounded-xl"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !prompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-14 w-14 shadow-md shadow-indigo-900/20 rounded-xl transition-all disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>

      </Card>
    </div>
  );
}