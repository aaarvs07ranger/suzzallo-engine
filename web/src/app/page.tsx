"use client";

import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Library, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

const cards = [
  {
    icon: ShieldCheck,
    eyebrow: "Context first",
    title: "Review transcript data before it changes the plan.",
    body: "See your major, completed courses, and missing requirements in the workspace instead of trusting an invisible extraction step.",
  },
  {
    icon: SlidersHorizontal,
    eyebrow: "Visible tradeoffs",
    title: "Set mornings, end times, Friday-free weeks, and professor quality explicitly.",
    body: "The planner surfaces the priorities you chose so your schedule feels intentional, not guessed.",
  },
  {
    icon: CalendarDays,
    eyebrow: "Compare options",
    title: "Inspect a few strong schedules instead of one mysterious “best” answer.",
    body: "Compare week shape, gap time, professor fit, and registration details in a calmer, more useful interface.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(17,94,89,0.14),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(217,119,6,0.10),_transparent_28%),linear-gradient(180deg,#f7f1e8_0%,#f1ebe2_52%,#ece5da_100%)] px-4 py-5 text-stone-900 md:px-6">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/75 shadow-[0_25px_80px_rgba(68,64,60,0.08)] backdrop-blur"
        >
          <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-12">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">
                <Library className="h-4 w-4" />
                Suzzallo Planner
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-stone-950 md:text-6xl">
                Quarter planning without the blank-prompt gamble.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
                Upload a UW transcript if you want context, set real scheduling priorities, and compare a few strong schedules in one workspace. Less AI theater, more useful planning.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/chat">
                  <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Open planner
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <div className="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  Transcript review stays visible before schedule generation.
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-[2rem] border border-stone-200 bg-[#fffdfa] p-5">
              <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">How it flows</div>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                  <li>Upload a transcript or start manual.</li>
                  <li>Review extracted context and choose priorities.</li>
                  <li>Compare schedule options and inspect SLNs.</li>
                </ol>
              </div>
              <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 px-5 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Built for trust</div>
                <p className="mt-4 text-sm leading-6 text-stone-700">
                  The planner makes the transcript context, schedule tradeoffs, and section-level details visible instead of burying them inside a single answer.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-3">
          {cards.map(({ icon: Icon, eyebrow, title, body }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 * index }}
              className="rounded-[2rem] border border-white/70 bg-white/80 px-6 py-6 shadow-[0_20px_60px_rgba(68,64,60,0.08)]"
            >
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800 w-fit">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">{eyebrow}</div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-stone-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{body}</p>
            </motion.article>
          ))}
        </section>
      </div>
    </div>
  );
}
