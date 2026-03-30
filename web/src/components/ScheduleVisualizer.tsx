"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, Star } from "lucide-react";

// Dummy data to test the UI until we wire up the backend JSON
const MOCK_SCHEDULE = [
  { id: 1, name: "CSE 142", type: "Lecture", days: ["M", "W", "F"], start: 10, duration: 1, prof: "Smith", rating: 4.5, loc: "KNE 110", color: "from-blue-500/20 to-indigo-500/20 border-indigo-500/30 text-indigo-300" },
  { id: 2, name: "MATH 124", type: "Lecture", days: ["T", "Th"], start: 11.5, duration: 1.5, prof: "Loveless", rating: 4.8, loc: "GWN 301", color: "from-emerald-500/20 to-teal-500/20 border-teal-500/30 text-teal-300" },
  { id: 3, name: "DRAMA 101", type: "Lecture", days: ["M", "W"], start: 13, duration: 1.5, prof: "Odai", rating: 4.9, loc: "HUT 130", color: "from-purple-500/20 to-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-300" }
];

const DAYS = ["M", "T", "W", "Th", "F"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export default function ScheduleVisualizer() {
  return (
    <div className="w-full mt-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 p-4 shadow-xl backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Proposed Schedule</h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">14 Credits</span>
      </div>

      {/* Grid Container */}
      <div className="relative grid grid-cols-[50px_repeat(5,1fr)] gap-2">
        {/* Header Row */}
        <div className="col-start-1"></div>
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-bold text-slate-400 pb-2">
            {day}
          </div>
        ))}

        {/* Time Slots & Background Grid */}
        {HOURS.map((hour, i) => (
          <div key={hour} className="contents">
            <div className="text-right pr-2 text-[10px] text-slate-500 font-medium -mt-2">
              {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
            </div>
            {DAYS.map((day) => (
              <div key={`${day}-${hour}`} className="h-12 border-t border-slate-800/50 relative"></div>
            ))}
          </div>
        ))}

        {/* Render the Classes */}
        {MOCK_SCHEDULE.map((cls, index) => (
          cls.days.map((day) => {
            const dayIndex = DAYS.indexOf(day);
            const startOffset = cls.start - 8; // Hours from 8 AM
            
            return (
              <motion.div
                key={`${cls.id}-${day}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`absolute p-2 rounded-lg border bg-gradient-to-br shadow-lg backdrop-blur-md cursor-pointer hover:brightness-125 transition-all ${cls.color}`}
                style={{
                  gridColumn: dayIndex + 2, // +2 because col 1 is time labels
                  top: `${(startOffset * 48) + 24}px`, // 48px per hour, +24 for header
                  height: `${cls.duration * 48 - 4}px`, // Subtract 4px for a nice gap
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
          })
        ))}
      </div>
    </div>
  );
}