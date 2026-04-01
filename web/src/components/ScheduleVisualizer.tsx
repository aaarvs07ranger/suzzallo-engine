"use client";

import { useState } from "react";
import { CalendarRange, Clock3, MapPin, Star, Ticket } from "lucide-react";

export type CourseData = {
  id?: string | number;
  name: string;
  type?: string;
  days: string[];
  start: number;
  duration: number;
  prof: string;
  rating?: number | null;
  reviews_count?: number | null;
  loc: string;
  color?: string;
  time_label?: string;
  days_label?: string;
  section?: string;
  sln?: string;
};

const DAYS = ["M", "T", "W", "Th", "F"];
const PALETTE = [
  "bg-emerald-100 border-emerald-300 text-emerald-950",
  "bg-amber-100 border-amber-300 text-amber-950",
  "bg-sky-100 border-sky-300 text-sky-950",
  "bg-rose-100 border-rose-300 text-rose-950",
  "bg-violet-100 border-violet-300 text-violet-950",
  "bg-cyan-100 border-cyan-300 text-cyan-950",
];

function formatHourLabel(hour: number) {
  const displayHour = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${displayHour}:00 ${suffix}`;
}

function sortMeetings(data: CourseData[]) {
  return [...data].sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
}

export default function ScheduleVisualizer({ data }: { data?: CourseData[] }) {
  const meetings = sortMeetings(data ?? []);
  const [activeMeetingId, setActiveMeetingId] = useState<string | number | null>(null);

  if (!meetings.length) {
    return (
      <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-6 text-sm text-stone-600">
        No schedule has been selected yet.
      </div>
    );
  }

  const minStart = Math.max(8, Math.floor(Math.min(...meetings.map((meeting) => meeting.start))));
  const maxEnd = Math.min(21, Math.ceil(Math.max(...meetings.map((meeting) => meeting.start + meeting.duration))));
  const hours = Array.from({ length: maxEnd - minStart + 1 }, (_, index) => minStart + index);
  const rowHeight = 76;
  const courseNames = Array.from(new Set(meetings.map((meeting) => meeting.name)));
  const colorByCourse = new Map(
    courseNames.map((courseName, index) => [courseName, PALETTE[index % PALETTE.length]])
  );
  const activeMeeting =
    meetings.find((meeting) => meeting.id === activeMeetingId) ??
    meetings[0] ??
    null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Meetings</div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">{meetings.length}</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Campus Days</div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {new Set(meetings.flatMap((meeting) => meeting.days)).size}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Earliest Start</div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">
            {meetings[0]?.time_label?.split("-")[0] ?? formatHourLabel(minStart)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#fffdfa]">
        <div className="border-b border-stone-200 bg-white/80 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
            <CalendarRange className="h-4 w-4 text-emerald-700" />
            Weekly schedule
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Tap a class block to inspect the exact section, location, and registration details.
          </p>
        </div>

        <div className="px-4 py-4 md:hidden">
          <div className="space-y-3">
            {meetings.map((meeting) => {
              const cardColor = colorByCourse.get(meeting.name) ?? PALETTE[0];
              return (
                <button
                  key={String(meeting.id)}
                  type="button"
                  onClick={() => setActiveMeetingId(meeting.id ?? null)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${cardColor} ${
                    activeMeeting?.id === meeting.id ? "ring-2 ring-emerald-600/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{meeting.name}</div>
                      <div className="mt-1 text-sm opacity-80">
                        {meeting.days_label ?? meeting.days.join("")} • {meeting.time_label}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] opacity-70">{meeting.type}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {meeting.loc}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {meeting.rating ? `${meeting.rating.toFixed(1)} ${meeting.prof}` : meeting.prof}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden px-4 py-4 md:block">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-x-3 pb-3">
                <div />
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="rounded-xl bg-stone-100 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-stone-600"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="relative">
                <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-x-3">
                  {hours.map((hour, rowIndex) => (
                    <div key={hour} className="contents">
                      <div className="pt-0.5 text-right text-[11px] font-medium text-stone-500">
                        {formatHourLabel(hour)}
                      </div>
                      {DAYS.map((day) => (
                        <div
                          key={`${day}-${hour}`}
                          className={`h-[76px] rounded-xl border ${
                            rowIndex % 2 === 0 ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-50/70"
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute inset-y-0 left-[76px] right-0">
                  {meetings.map((meeting) => {
                    const firstDay = meeting.days[0];
                    const dayIndex = DAYS.indexOf(firstDay);
                    const top = (meeting.start - minStart) * rowHeight;
                    const height = Math.max(54, meeting.duration * rowHeight - 6);
                    const cardColor = colorByCourse.get(meeting.name) ?? PALETTE[0];

                    if (dayIndex === -1) {
                      return null;
                    }

                    return (
                      <button
                        key={String(meeting.id)}
                        type="button"
                        onClick={() => setActiveMeetingId(meeting.id ?? null)}
                        className={`pointer-events-auto absolute rounded-2xl border px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 ${cardColor} ${
                          activeMeeting?.id === meeting.id ? "ring-2 ring-emerald-600/30" : ""
                        }`}
                        style={{
                          left: `calc(${dayIndex * 20}% + 6px)`,
                          width: "calc(20% - 12px)",
                          top,
                          height,
                        }}
                      >
                        <div className="line-clamp-2 text-sm font-semibold">{meeting.name}</div>
                        <div className="mt-1 text-xs opacity-75">
                          {meeting.type} • {meeting.time_label}
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] opacity-80">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{meeting.loc}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            <span className="truncate">
                              {meeting.rating ? `${meeting.rating.toFixed(1)} • ` : ""}
                              {meeting.prof}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeMeeting && (
        <div className="grid gap-4 rounded-[1.75rem] border border-stone-200 bg-white/90 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Selected section</div>
            <h3 className="mt-2 text-2xl font-semibold text-stone-950">{activeMeeting.name}</h3>
            <p className="mt-2 max-w-2xl text-sm text-stone-600">
              {activeMeeting.type} on {activeMeeting.days_label ?? activeMeeting.days.join("")} at{" "}
              {activeMeeting.time_label}.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-700" />
                {activeMeeting.time_label}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-700" />
                {activeMeeting.loc}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-emerald-700" />
                {activeMeeting.rating ? `${activeMeeting.rating.toFixed(1)} rating` : "No rating yet"}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-emerald-700" />
                {activeMeeting.section ? `Section ${activeMeeting.section}` : "Section TBD"}
                {activeMeeting.sln ? ` • SLN ${activeMeeting.sln}` : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
