"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Library, Paperclip, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "agent";
  content: string;
};

export default function SuzzalloApp() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", content: "Welcome to Suzzallo. Upload your unofficial transcript to get started, or just tell me what you want to take." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [studentContext, setStudentContext] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // --- NEW: PDF Upload Logic ---
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
      setStudentContext(data); // Save the JSON to React state
      
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
        // --- NEW: Send the context if we have it ---
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
    <div className="flex h-screen bg-slate-50 items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-xl border-slate-200 overflow-hidden">
        
        {/* Header */}
        <CardHeader className="border-b bg-white px-6 py-4 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Library className="text-white h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">Suzzallo</CardTitle>
              <p className="text-sm text-slate-500 font-medium">The AI Academic Strategist • UW Seattle</p>
            </div>
          </div>
          
          {/* Status Indicator */}
          {studentContext && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-xs font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Transcript Synced
            </div>
          )}
        </CardHeader>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-50/50 scroll-smooth">
          <div className="flex flex-col gap-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "agent" && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-indigo-600" />
                  </div>
                )}
                
                <div className={`px-5 py-4 rounded-2xl max-w-[80%] shadow-sm prose prose-sm max-w-none ${
                  msg.role === "user" 
                    ? "bg-indigo-600 text-white rounded-br-none prose-invert" 
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-none prose-slate"
                }`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                    <User className="h-5 w-5 text-slate-600" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 justify-start">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-indigo-600 animate-pulse" />
                  </div>
                <div className="px-5 py-4 rounded-2xl bg-white border border-slate-200 rounded-bl-none text-slate-400 text-sm animate-pulse">
                  Processing...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3 items-center"
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
              className="h-14 w-14 rounded-xl border-slate-300 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <Input 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type your constraints..." 
              className="flex-1 border-slate-300 focus-visible:ring-indigo-600 shadow-sm text-base h-14 rounded-xl"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !prompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-14 w-14 shadow-sm rounded-xl transition-all"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>

      </Card>
    </div>
  );
}