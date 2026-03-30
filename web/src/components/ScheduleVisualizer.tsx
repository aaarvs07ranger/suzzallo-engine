"use client";

import { motion } from "framer-motion";
import { MapPin, Star } from "lucide-react";

export type CourseData = {
  id?: string | number;
  name: string;
  type?: string;
  days: string[];
  start: number; // e.g., 10.5 for 10:30 AM
  duration: number; // e.g., 1.5 for 1.5 hours
  prof: string;
  rating: number;
  loc: string;
  color?: string;
};

// Fallback data just in case the backend sends an empty array
const FALLBACK_SCHEDULE: CourseData[] = [
  { id: 1, name: "CSE 142", type: "Lecture", days: ["M", "W", "F"], start: 10, duration: 1, prof: "Smith", rating: 4.5, loc: "KNE 110" },
  { id: 2, name: "MATH 124", type: "Lecture", days: ["T", "Th"], start: 11.5, duration: 1.5, prof: "Loveless", rating: 4.8, loc: "GWN 301" },
  { id: 3, name: "DRAMA 101", type: "Lecture", days: ["M", "W"], start: 13, duration: 1.5, prof: "Odai", rating: 4.9, loc: "HUT 130" }
];

const COLORS = [
  "from-blue-500/20 to-indigo-500/20 border-indigo-500/30 text-indigo-300",
  "from-emerald-500/20 to-teal-500/20 border-teal-500/30 text-teal-300",
  "from-purple-500/20 to-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-300",
  "from-amber-500/20 to-orange-500/20 border-orange-500/30 text-orange-300",
  "from-rose-500/20 to-pink-500/20 border-pink-500/30 text-pink-300"
];

const DAYS = ["M", "T", "W", "Th", "F"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export default function ScheduleVisualizer({ data }: { data?: CourseData[] }) {
  // Use backend data if provided, otherwise fallback to the mock data
  const scheduleToRender = data && data.length > 0 ? data : FALLBACK_SCHEDULE;

  // Calculate total credits (assuming 5 per class for UI purposes, can be dynamic later)
  const totalCredits = scheduleToRender.length * 5 - (scheduleToRender.length > 2 ? 1 : 0);

  return (
    <div className="w-full mt-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 p-4 shadow-xl backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Proposed Schedule</h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{totalCredits} Credits</span>
      </div>

      <div className="relative grid grid-cols-[50px_repeat(5,1fr)] gap-2">
        <div className="col-start-1"></div>
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-bold text-slate-400 pb-2">
            {day}
          </div>
        ))}

        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="text-right pr-2 text-[10px] text-slate-500 font-medium -mt-2">
              {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
            </div>
            {DAYS.map((day) => (
              <div key={`${day}-${hour}`} className="h-12 border-t border-slate-800/50 relative"></div>
            ))}
          </div>
        ))}

        {scheduleToRender.map((cls, index) => {
          const colorClass = cls.color || COLORS[index % COLORS.length]; // Auto-assign a color

          return cls.days.map((day) => {
            const dayIndex = DAYS.indexOf(day);
            if (dayIndex === -1) return null; // Skip invalid days
            const startOffset = cls.start - 8; 
            
            return (
              <motion.div
                key={`${cls.name}-${day}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`absolute p-2 rounded-lg border bg-gradient-to-br shadow-lg backdrop-blur-md cursor-pointer hover:brightness-125 transition-all ${colorClass}`}
                style={{
                  gridColumn: dayIndex + 2, 
                  top: `${(startOffset * 48) + 24}px`, 
                  height: `${cls.duration * 48 - 4}px`, 
                  width: 'calc(100% - 8px)',
                  left: '4px'
                }}
              >
                <div className="font-bold text-xs leading-tight mb-1">{cls.name}</div>
                <div className="text-[9px] opacity-80 flex flex-col gap-0.5">
                  <span className="flex items-center gap-1"><MapPin className="h-2 w-2"/> {cls.loc}</span>
                  <span className="flex items-center gap-1"><Star className="h-2 w-2"/> {cls.rating} {cls.prof}</span>
                </div>
              </motion.div>
            );
          });
        })}
      </div>
    </div>
  );
}