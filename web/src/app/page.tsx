"use client";

import { motion } from "framer-motion";
import { ArrowRight, Library } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden relative selection:bg-indigo-500/30">
      
      {/* Background Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="z-10 flex flex-col items-center text-center px-4 max-w-4xl">
        
        {/* Logo Reveal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 backdrop-blur-sm">
            <Library className="text-indigo-400 h-8 w-8" />
          </div>
          <span className="text-xl font-semibold text-slate-300 tracking-widest uppercase">Suzzallo Core</span>
        </motion.div>

        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
            The Academic <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Superintelligence.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed">
            Upload your UW transcript. Set your constraints. Let the engine cross-reference RateMyProfessors, analyze the time schedule, and instantly generate the mathematically perfect quarter.
          </p>
        </motion.div>

        {/* Launch Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/chat">
            <button className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-950 font-semibold rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                Initialize Engine
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Link>
        </motion.div>

      </div>
    </div>
  );
}