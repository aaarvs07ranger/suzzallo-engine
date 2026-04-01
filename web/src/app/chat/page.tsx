"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CircleAlert,
  Library,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import ScheduleVisualizer, { CourseData } from "@/components/ScheduleVisualizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://suzzallo-engine.onrender.com";
const STORAGE_KEY = "suzzallo-planner-v2";
const TIME_OPTIONS = ["", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const PROMPT_SUGGESTIONS = [
  "Keep my mornings free.",
  "I want the best professors you can find.",
  "Try to keep Friday open.",
  "Make the week compact with fewer campus days.",
];

type TranscriptSummary = {
  ok: boolean;
  major: string;
  completed_courses: string[];
  missing_requirements: string[];
  stats?: {
    completed_count: number;
    missing_count: number;
  };
  error?: string;
};

type PlannerPreferences = {
  desired_courses: string[];
  no_classes_before: string;
  no_classes_after: string;
  avoid_fridays: boolean;
  prioritize_chill: boolean;
  compact_schedule: boolean;
};

type ScheduleOption = {
  id: string;
  rank: number;
  label: string;
  description: string;
  metrics: {
    credits: number;
    days_on_campus: number;
    fridays_free: boolean;
    earliest_start?: string | null;
    latest_end?: string | null;
    gap_minutes: number;
    gap_hours: number;
    average_rating?: number | null;
    rated_sections: number;
  };
  why_this_works: string[];
  courses: Array<{
    course: string;
    section_label: string;
    credits: number;
    professor: string;
    rating?: number | null;
    slns: string[];
    meetings: CourseData[];
  }>;
  schedule_data: CourseData[];
};

type PlannerResult = {
  ok: boolean;
  agent_response: string;
  constraints: PlannerPreferences;
  total_found: number;
  schedule_options: ScheduleOption[];
  schedule_data: CourseData[];
  error?: string;
};

type LoadingState = {
  status: "idle" | "loading" | "done" | "error";
  message: string;
};

function normalizeCourseInput(input: string) {
  const matches = input.toUpperCase().match(/\b[A-Z]{2,5}\s*-?\s*\d{3}[A-Z]?\b/g) ?? [];
  const normalized = matches.map((match) => match.replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim());
  return Array.from(new Set(normalized));
}

function formatMetricValue(option: ScheduleOption, key: "credits" | "days_on_campus" | "average_rating" | "gap_hours") {
  if (key === "average_rating") {
    return option.metrics.average_rating ? option.metrics.average_rating.toFixed(1) : "N/A";
  }
  if (key === "gap_hours") {
    return `${option.metrics.gap_hours.toFixed(1)}h`;
  }
  return `${option.metrics[key]}`;
}

function priorityPills(preferences: PlannerPreferences) {
  const pills: string[] = [];
  if (preferences.no_classes_before) pills.push(`After ${preferences.no_classes_before}`);
  if (preferences.no_classes_after) pills.push(`Done by ${preferences.no_classes_after}`);
  if (preferences.avoid_fridays) pills.push("Friday free");
  if (preferences.prioritize_chill) pills.push("Best professors");
  if (preferences.compact_schedule) pills.push("Compact days");
  return pills;
}

function scheduleHintFromTranscript(summary: TranscriptSummary | null) {
  if (!summary) return [];
  const text = summary.missing_requirements.join(" ");
  return normalizeCourseInput(text).slice(0, 3);
}

function StatusMessage({ state }: { state: LoadingState }) {
  if (state.status === "idle") return null;

  const tone =
    state.status === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : state.status === "done"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-stone-200 bg-stone-50 text-stone-700";

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      {state.status === "loading" ? (
        <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin" />
      ) : state.status === "done" ? (
        <BadgeCheck className="mt-0.5 h-4 w-4" />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4" />
      )}
      <span>{state.message}</span>
    </div>
  );
}

export default function SuzzalloPlanner() {
  const [studentContext, setStudentContext] = useState<TranscriptSummary | null>(null);
  const [fileName, setFileName] = useState("");
  const [courseInput, setCourseInput] = useState("");
  const [prompt, setPrompt] = useState("");
  const [preferences, setPreferences] = useState<PlannerPreferences>({
    desired_courses: [],
    no_classes_before: "",
    no_classes_after: "",
    avoid_fridays: false,
    prioritize_chill: false,
    compact_schedule: false,
  });
  const [plannerResult, setPlannerResult] = useState<PlannerResult | null>(null);
  const [activeOptionId, setActiveOptionId] = useState("");
  const [uploadState, setUploadState] = useState<LoadingState>({ status: "idle", message: "" });
  const [planningState, setPlanningState] = useState<LoadingState>({ status: "idle", message: "" });
  const [pageError, setPageError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStudentContext(parsed.studentContext ?? null);
        setFileName(parsed.fileName ?? "");
        setCourseInput(parsed.courseInput ?? "");
        setPrompt(parsed.prompt ?? "");
        setPreferences(
          parsed.preferences ?? {
            desired_courses: [],
            no_classes_before: "",
            no_classes_after: "",
            avoid_fridays: false,
            prioritize_chill: false,
            compact_schedule: false,
          }
        );
        setPlannerResult(parsed.plannerResult ?? null);
        setActiveOptionId(parsed.activeOptionId ?? "");
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        studentContext,
        fileName,
        courseInput,
        prompt,
        preferences,
        plannerResult,
        activeOptionId,
      })
    );
  }, [hydrated, studentContext, fileName, courseInput, prompt, preferences, plannerResult, activeOptionId]);

  const activeOption =
    plannerResult?.schedule_options.find((option) => option.id === activeOptionId) ??
    plannerResult?.schedule_options[0] ??
    null;

  const transcriptSuggestions = scheduleHintFromTranscript(studentContext);
  const normalizedCourses = normalizeCourseInput(courseInput);
  const currentPills = priorityPills({ ...preferences, desired_courses: normalizedCourses });

  async function analyzeFile(file: File) {
    setPageError("");
    setFileName(file.name);
    setUploadState({ status: "loading", message: "Reading your transcript and extracting your academic snapshot..." });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/analyze-transcript`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as TranscriptSummary;

      if (!data.ok) {
        throw new Error(data.error || "Transcript parsing failed.");
      }

      setStudentContext(data);
      if (!courseInput.trim()) {
        const suggestions = scheduleHintFromTranscript(data);
        if (suggestions.length) {
          setCourseInput(suggestions.join(", "));
        }
      }
      setUploadState({
        status: "done",
        message: `Transcript reviewed. ${data.major} detected with ${data.stats?.completed_count ?? data.completed_courses.length} completed courses.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "I couldn't review that transcript.";
      setUploadState({ status: "error", message });
      setPageError(message);
    }
  }

  async function handleGeneratePlan() {
    setPageError("");
    setPlanningState({ status: "loading", message: "Comparing open sections, checking conflicts, and ranking your best schedule options..." });

    const nextPreferences = {
      ...preferences,
      desired_courses: normalizedCourses,
    };

    try {
      const response = await fetch(`${API_BASE}/generate-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          student_context: studentContext,
          preferences: nextPreferences,
        }),
      });
      const data = (await response.json()) as PlannerResult;

      if (!data.ok) {
        throw new Error(data.error || "Schedule generation failed.");
      }

      setPreferences(data.constraints);
      setPlannerResult(data);
      setActiveOptionId(data.schedule_options[0]?.id ?? "");
      setPlanningState({
        status: "done",
        message: `Found ${data.total_found} valid schedules and surfaced ${data.schedule_options.length} strong options to compare.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "I couldn't build a schedule right now.";
      setPlanningState({ status: "error", message });
      setPageError(message);
    }
  }

  function resetWorkspace() {
    setStudentContext(null);
    setFileName("");
    setCourseInput("");
    setPrompt("");
    setPreferences({
      desired_courses: [],
      no_classes_before: "",
      no_classes_after: "",
      avoid_fridays: false,
      prioritize_chill: false,
      compact_schedule: false,
    });
    setPlannerResult(null);
    setActiveOptionId("");
    setUploadState({ status: "idle", message: "" });
    setPlanningState({ status: "idle", message: "" });
    setPageError("");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(17,94,89,0.14),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(217,119,6,0.10),_transparent_30%),linear-gradient(180deg,#f7f1e8_0%,#f3eee5_55%,#efe9df_100%)] px-4 py-5 text-stone-900 md:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/70 px-5 py-5 shadow-[0_20px_60px_rgba(68,64,60,0.08)] backdrop-blur xl:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                <Library className="h-7 w-7" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-stone-500">Suzzallo Planner</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
                  Build a quarter that fits your real life.
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600 md:text-base">
                  Review your transcript, set visible priorities, and compare a few strong schedules instead of hoping a blank chat prompt guesses what matters to you.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                Transcript review stays visible before planning
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-stone-300 bg-white px-5 text-stone-800 hover:bg-stone-50"
                onClick={resetWorkspace}
              >
                <Trash2 className="h-4 w-4" />
                Reset workspace
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6 xl:sticky xl:top-5 xl:self-start">
            <Card className="rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_50px_rgba(68,64,60,0.08)]">
              <CardHeader className="px-5 pt-5">
                <CardTitle className="flex items-center gap-2 text-lg text-stone-900">
                  <Upload className="h-5 w-5 text-emerald-700" />
                  Transcript review
                </CardTitle>
                <p className="text-sm leading-6 text-stone-600">
                  Upload an unofficial transcript if you want Suzzallo to plan with your major and completed-course context.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) {
                      void analyzeFile(file);
                    }
                  }}
                  className={`flex w-full flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-5 py-7 text-center transition ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-stone-300 bg-stone-50 hover:border-emerald-400 hover:bg-emerald-50/50"
                  }`}
                >
                  <div className="rounded-full bg-white p-3 text-emerald-700 shadow-sm">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-medium text-stone-900">Upload PDF transcript</div>
                  <div className="mt-1 max-w-xs text-sm leading-6 text-stone-600">
                    Drag and drop here or choose a file. You’ll review the extracted context before it affects planning.
                  </div>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void analyzeFile(file);
                    }
                  }}
                />

                {fileName && (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <div className="font-medium text-stone-900">{fileName}</div>
                    <div className="mt-1">PDF uploaded to the planner workspace.</div>
                  </div>
                )}

                <StatusMessage state={uploadState} />

                {studentContext && (
                  <div className="space-y-4 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/70 px-4 py-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-emerald-800">Academic snapshot</div>
                      <div className="mt-2 text-xl font-semibold text-stone-950">{studentContext.major}</div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Completed</div>
                        <div className="mt-2 text-2xl font-semibold text-stone-900">
                          {studentContext.stats?.completed_count ?? studentContext.completed_courses.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Missing cues</div>
                        <div className="mt-2 text-2xl font-semibold text-stone-900">
                          {studentContext.stats?.missing_count ?? studentContext.missing_requirements.length}
                        </div>
                      </div>
                    </div>

                    {studentContext.missing_requirements.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Missing requirements</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {studentContext.missing_requirements.slice(0, 6).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-white/90 bg-white/80 px-3 py-1.5 text-xs text-stone-700"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_50px_rgba(68,64,60,0.08)]">
              <CardHeader className="px-5 pt-5">
                <CardTitle className="flex items-center gap-2 text-lg text-stone-900">
                  <SlidersHorizontal className="h-5 w-5 text-amber-700" />
                  Planning controls
                </CardTitle>
                <p className="text-sm leading-6 text-stone-600">
                  Set the courses you care about, then make your tradeoffs visible before you generate.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-800">Courses to plan</label>
                  <Textarea
                    value={courseInput}
                    onChange={(event) => setCourseInput(event.target.value)}
                    placeholder="Examples: CSE 121, MATH 124, ENGL 131"
                    className="min-h-[92px] rounded-2xl border-stone-300 bg-stone-50 text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-500"
                  />
                  <p className="text-xs text-stone-500">Use commas or new lines. The planner reads course codes from this field first.</p>
                </div>

                {transcriptSuggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Suggested from transcript</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {transcriptSuggestions.map((course) => (
                        <button
                          key={course}
                          type="button"
                          onClick={() => setCourseInput((current) => Array.from(new Set([...normalizeCourseInput(current), course])).join(", "))}
                          className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 transition hover:border-emerald-500 hover:bg-emerald-50"
                        >
                          {course}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-800">No classes before</label>
                    <select
                      value={preferences.no_classes_before}
                      onChange={(event) =>
                        setPreferences((current) => ({ ...current, no_classes_before: event.target.value }))
                      }
                      className="h-11 w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-emerald-500"
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={`before-${option || "any"}`} value={option}>
                          {option || "No morning limit"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-800">Try to finish by</label>
                    <select
                      value={preferences.no_classes_after}
                      onChange={(event) =>
                        setPreferences((current) => ({ ...current, no_classes_after: event.target.value }))
                      }
                      className="h-11 w-full rounded-2xl border border-stone-300 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-emerald-500"
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={`after-${option || "any"}`} value={option}>
                          {option || "No end-time limit"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-800">Planner priorities</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreferences((current) => ({ ...current, avoid_fridays: !current.avoid_fridays }))
                      }
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        preferences.avoid_fridays
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-500"
                      }`}
                    >
                      Friday free
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreferences((current) => ({ ...current, prioritize_chill: !current.prioritize_chill }))
                      }
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        preferences.prioritize_chill
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-500"
                      }`}
                    >
                      Best professors
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreferences((current) => ({ ...current, compact_schedule: !current.compact_schedule }))
                      }
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        preferences.compact_schedule
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-500"
                      }`}
                    >
                      Compact days
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-800">Anything else to respect?</label>
                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Examples: keep my mornings open, I commute from off campus, balance hard classes with one lighter class..."
                    className="min-h-[120px] rounded-2xl border-stone-300 bg-stone-50 text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setPrompt((current) => (current ? `${current} ${suggestion}` : suggestion))}
                        className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 transition hover:border-emerald-500 hover:bg-emerald-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {currentPills.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Current priorities</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentPills.map((pill) => (
                        <span
                          key={pill}
                          className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700"
                        >
                          {pill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row xl:flex-col">
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 rounded-full bg-emerald-700 px-5 text-white hover:bg-emerald-600"
                    onClick={() => void handleGeneratePlan()}
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate plan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12 rounded-full border-stone-300 bg-white px-5 text-stone-800 hover:bg-stone-50"
                    onClick={() => {
                      setPrompt("");
                      setPlanningState({ status: "idle", message: "" });
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Clear note
                  </Button>
                </div>

                <StatusMessage state={planningState} />
              </CardContent>
            </Card>
          </aside>

          <main className="space-y-6">
            {pageError && (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
                {pageError}
              </div>
            )}

            {!plannerResult && (
              <Card className="rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_50px_rgba(68,64,60,0.08)]">
                <CardHeader className="px-6 pt-6">
                  <CardTitle className="flex items-center gap-2 text-xl text-stone-950">
                    <CalendarDays className="h-5 w-5 text-emerald-700" />
                    What the improved planner does
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-3">
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">1. Review</div>
                    <h3 className="mt-3 text-lg font-semibold text-stone-900">See your context before it drives anything</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      Transcript parsing stays visible, including your major and the requirements it appears you still need.
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">2. Prioritize</div>
                    <h3 className="mt-3 text-lg font-semibold text-stone-900">Make tradeoffs explicit</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      Use visible controls for mornings, end times, Friday-free weeks, compact days, and stronger professor ratings.
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">3. Compare</div>
                    <h3 className="mt-3 text-lg font-semibold text-stone-900">Inspect more than one “best” answer</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      The planner surfaces a few strong schedule directions so you can compare week shape, professor fit, and time tradeoffs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {plannerResult && (
              <>
                <Card className="rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_50px_rgba(68,64,60,0.08)]">
                  <CardHeader className="px-6 pt-6">
                    <CardTitle className="flex items-center gap-2 text-xl text-stone-950">
                      <BookOpen className="h-5 w-5 text-amber-700" />
                      Planner brief
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 pb-6">
                    <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                      <div className="prose prose-stone max-w-none prose-p:my-0 prose-strong:text-stone-950">
                        <ReactMarkdown>{plannerResult.agent_response}</ReactMarkdown>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {plannerResult.constraints.desired_courses.map((course) => (
                        <span
                          key={course}
                          className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700"
                        >
                          {course}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <section className="grid gap-4 xl:grid-cols-3">
                  {plannerResult.schedule_options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setActiveOptionId(option.id)}
                      className={`rounded-[2rem] border px-5 py-5 text-left shadow-[0_20px_50px_rgba(68,64,60,0.08)] transition hover:-translate-y-0.5 ${
                        activeOption?.id === option.id
                          ? "border-emerald-500 bg-emerald-50/80"
                          : "border-white/70 bg-white/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
                            Option {option.rank}
                          </div>
                          <h3 className="mt-2 text-xl font-semibold text-stone-950">{option.label}</h3>
                          <p className="mt-2 text-sm leading-6 text-stone-600">{option.description}</p>
                        </div>
                        {activeOption?.id === option.id && (
                          <div className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
                            Viewing
                          </div>
                        )}
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                        <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.22em] text-stone-500">Credits</div>
                          <div className="mt-2 text-2xl font-semibold text-stone-900">
                            {formatMetricValue(option, "credits")}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.22em] text-stone-500">Campus days</div>
                          <div className="mt-2 text-2xl font-semibold text-stone-900">
                            {formatMetricValue(option, "days_on_campus")}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.22em] text-stone-500">Avg rating</div>
                          <div className="mt-2 text-2xl font-semibold text-stone-900">
                            {formatMetricValue(option, "average_rating")}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.22em] text-stone-500">Gap time</div>
                          <div className="mt-2 text-2xl font-semibold text-stone-900">
                            {formatMetricValue(option, "gap_hours")}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {option.why_this_works.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-stone-300 bg-white/80 px-3 py-1.5 text-xs text-stone-700"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </section>
              </>
            )}

            {activeOption && (
              <section className="space-y-6">
                <Card className="rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_50px_rgba(68,64,60,0.08)]">
                  <CardHeader className="px-6 pt-6">
                    <CardTitle className="flex items-center gap-2 text-xl text-stone-950">
                      <CalendarDays className="h-5 w-5 text-emerald-700" />
                      {activeOption.label}
                    </CardTitle>
                    <p className="text-sm leading-6 text-stone-600">
                      Inspect the weekly shape, then use the section cards below for SLNs, professors, and meeting details.
                    </p>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <ScheduleVisualizer data={activeOption.schedule_data} />
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  {activeOption.courses.map((course) => (
                    <Card
                      key={`${activeOption.id}-${course.course}-${course.section_label}`}
                      className="rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_50px_rgba(68,64,60,0.08)]"
                    >
                      <CardHeader className="px-6 pt-6">
                        <CardTitle className="text-xl text-stone-950">{course.course}</CardTitle>
                        <p className="text-sm leading-6 text-stone-600">
                          Section {course.section_label || "TBD"} • {course.credits} credits • {course.professor}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4 px-6 pb-6">
                        <div className="flex flex-wrap gap-2">
                          {course.slns.map((sln) => (
                            <span
                              key={sln}
                              className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700"
                            >
                              SLN {sln}
                            </span>
                          ))}
                          {course.rating ? (
                            <span className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-700">
                              RMP {course.rating.toFixed(1)}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          {course.meetings.map((meeting) => (
                            <div
                              key={String(meeting.id)}
                              className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-stone-900">{meeting.type}</div>
                                  <div className="mt-1 text-sm text-stone-600">
                                    {meeting.days_label ?? meeting.days.join("")} • {meeting.time_label}
                                  </div>
                                </div>
                                <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700">
                                  {meeting.section ? `Section ${meeting.section}` : "Section"}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                                <span className="rounded-full border border-stone-300 bg-white px-3 py-1.5">
                                  {meeting.loc}
                                </span>
                                <span className="rounded-full border border-stone-300 bg-white px-3 py-1.5">
                                  {meeting.prof}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
