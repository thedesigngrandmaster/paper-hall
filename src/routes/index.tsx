import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CircleCheck,
  Clock,
  FileText,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Table2,
  TextCursorInput,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { getCatalog, gradePaper, startPaper } from "@/cbt/api";

export const Route = createFileRoute("/")({
  loader: () => getCatalog(),
  component: Home,
});

type SubjectId = "oop" | "excel" | "word";
type PresetId = "sprint" | "drill" | "standard" | "paper" | "marathon";

type Subject = {
  id: SubjectId;
  code: string;
  title: string;
  blurb: string;
  english: number;
  gaps: number;
};

type Preset = {
  id: PresetId;
  label: string;
  questions: number;
  minutes: number;
};

type LiveQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  gap: boolean;
};

type Paper = {
  subject: SubjectId;
  code: string;
  title: string;
  preset: PresetId;
  minutes: number;
  seconds: number;
  questions: LiveQuestion[];
};

type Grade = {
  total: number;
  correct: number;
  percent: number;
  wrong: { prompt: string; gap: boolean; yourAnswer: string; correctAnswer: string }[];
};

const SUBJECT_ICONS: Record<SubjectId, LucideIcon> = {
  oop: Braces,
  excel: Table2,
  word: FileText,
};

function scrollToTop() {
  if (typeof window === "undefined") return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

const STEPS = [
  {
    title: "Pick your paper",
    copy: "Choose a CSC course and a length that fits the time you have.",
  },
  {
    title: "Sit the clock",
    copy: "One question at a time, with a palette to move around the paper.",
  },
  {
    title: "Review the misses",
    copy: "See what you scored and the exact answers you got wrong.",
  },
];

function Home() {
  const catalog = Route.useLoaderData();
  const [subject, setSubject] = useState<SubjectId>("oop");
  const [preset, setPreset] = useState<PresetId>("standard");
  const [includeGaps, setIncludeGaps] = useState(false);
  const [phase, setPhase] = useState<"lobby" | "paper" | "result">("lobby");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [usedSeconds, setUsedSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [leaveWaitlist, setLeaveWaitlist] = useState(false);

  const selectedPreset = catalog.presets.find((item) => item.id === preset) ?? catalog.presets[2]!;
  const selectedSubject =
    catalog.subjects.find((item) => item.id === subject) ?? catalog.subjects[0]!;
  const available = includeGaps
    ? selectedSubject.english + selectedSubject.gaps
    : selectedSubject.english;
  const presetFits = selectedPreset.questions <= available;
  const totalQuestions = catalog.subjects.reduce((sum, item) => sum + item.english + item.gaps, 0);

  async function begin() {
    setError("");
    setBusy(true);
    try {
      const next = await startPaper({ data: { subject, preset, includeGaps } });
      setPaper(next);
      setAnswers(next.questions.map(() => null));
      setIndex(0);
      setLeft(next.seconds);
      setGrade(null);
      setUsedSeconds(0);
      setConfirming(false);
      setLeaveWaitlist(false);
      setPhase("paper");
      scrollToTop();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The paper could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!paper || busy) return;
    setBusy(true);
    setConfirming(false);
    try {
      const result = await gradePaper({
        data: {
          subject: paper.subject,
          answers: paper.questions.map((question, position) => ({
            id: question.id,
            choice: answers[position] ?? null,
          })),
        },
      });
      setUsedSeconds(Math.max(0, paper.seconds - left));
      setGrade(result);
      setPhase("result");
      scrollToTop();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The paper could not be marked.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (phase !== "paper") return;
    const timer = window.setInterval(() => {
      setLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "paper" && left === 0 && paper && !grade) {
      void finish();
    }
    // finish closes over the latest answers via state; left===0 should submit once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  function reset() {
    setPhase("lobby");
    setPaper(null);
    setGrade(null);
    setError("");
    setConfirming(false);
    setLeaveWaitlist(false);
    setUsedSeconds(0);
    scrollToTop();
  }

  const presetLabel = paper
    ? (catalog.presets.find((item) => item.id === paper.preset)?.label ?? "Paper")
    : "";

  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar
        onNavigate={() => {
          if (phase === "paper") setLeaveWaitlist(true);
          return phase === "paper";
        }}
      />

      {phase !== "paper" ? <SiteHeader /> : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6 sm:pb-14">
        {phase === "lobby" ? (
          <Lobby
            catalog={catalog}
            totalQuestions={totalQuestions}
            subject={subject}
            preset={preset}
            includeGaps={includeGaps}
            available={available}
            presetFits={presetFits}
            busy={busy}
            error={error}
            onSubject={setSubject}
            onPreset={setPreset}
            onGaps={setIncludeGaps}
            onStart={() => void begin()}
          />
        ) : null}

        {phase === "paper" && paper ? (
          <Exam
            paper={paper}
            presetLabel={presetLabel}
            answers={answers}
            index={index}
            left={left}
            busy={busy}
            error={error}
            confirming={confirming}
            onPick={(choice) => {
              setAnswers((current) => {
                const next = [...current];
                next[index] = choice;
                return next;
              });
            }}
            onIndex={setIndex}
            onAskSubmit={() => setConfirming(true)}
            onCancelSubmit={() => setConfirming(false)}
            onSubmit={() => void finish()}
          />
        ) : null}

        {phase === "result" && grade && paper ? (
          <Result grade={grade} paper={paper} usedSeconds={usedSeconds} onAgain={reset} />
        ) : null}
      </main>

      {phase !== "paper" ? <SiteFooter /> : null}

      {leaveWaitlist ? (
        <Modal labelledBy="leave-title" onClose={() => setLeaveWaitlist(false)}>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-inner bg-navy-soft text-navy">
              <ArrowUpRight className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="leave-title" className="font-display text-2xl text-ink">
                Leave this paper?
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                The Selorah Health waitlist opens in a new tab. Your paper stays here when you come
                back.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              autoFocus
              className="min-h-12 rounded-inner border border-line bg-card px-4 font-medium text-ink transition hover:border-line-strong hover:bg-paper-soft"
              onClick={() => setLeaveWaitlist(false)}
            >
              Stay in the exam
            </button>
            <a
              href="http://selorah.app/"
              target="_blank"
              rel="noreferrer"
              onClick={() => setLeaveWaitlist(false)}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-inner bg-navy px-4 text-center font-semibold text-card transition hover:bg-navy-deep"
            >
              Open waitlist
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AnnouncementBar({ onNavigate }: { onNavigate: () => boolean }) {
  return (
    <a
      href="http://selorah.app/"
      className="group block bg-navy text-card"
      onClick={(event) => {
        if (onNavigate()) event.preventDefault();
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2.5 text-center text-xs sm:text-sm">
        <span className="hidden font-medium tracking-wide text-navy-muted sm:inline">
          From the studio
        </span>
        <span className="hidden h-3 w-px bg-card/25 sm:block" aria-hidden="true" />
        <span className="font-medium">Join the Selorah Health Waitlist</span>
        <ArrowUpRight
          className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </a>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 shrink-0" />
          <span>
            <span className="block font-display text-lg leading-none text-ink">Paper Hall</span>
            <span className="mt-1 block text-xs font-medium tracking-[0.16em] text-muted uppercase">
              CSC practice
            </span>
          </span>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted sm:inline-flex">
          <ShieldCheck className="size-3.5 text-navy" aria-hidden="true" />
          Answers hidden until submission
        </span>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© 2026 Paper Hall. Built for CSC revision.</p>
        <p>
          Designed by{" "}
          <a
            href="http://thedesigngrandmaster.me/"
            className="font-semibold text-navy underline decoration-line-strong underline-offset-4 transition hover:decoration-navy"
          >
            TDG
          </a>
        </p>
      </div>
    </footer>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" className="fill-navy" />
      <path
        d="M12 9.5h11.5L30 16v14.5a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V11.5a2 2 0 0 1 2-2Z"
        className="fill-card"
      />
      <path d="M23.5 9.5v5a1.5 1.5 0 0 0 1.5 1.5h5" className="fill-line" />
      <path
        d="M15 20.5h9M15 24.5h9M15 28.5h5.5"
        className="stroke-navy"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="29.5" cy="29.5" r="3.5" className="fill-rust" />
    </svg>
  );
}

function Lobby({
  catalog,
  totalQuestions,
  subject,
  preset,
  includeGaps,
  available,
  presetFits,
  busy,
  error,
  onSubject,
  onPreset,
  onGaps,
  onStart,
}: {
  catalog: { subjects: Subject[]; presets: Preset[] };
  totalQuestions: number;
  subject: SubjectId;
  preset: PresetId;
  includeGaps: boolean;
  available: number;
  presetFits: boolean;
  busy: boolean;
  error: string;
  onSubject: (id: SubjectId) => void;
  onPreset: (id: PresetId) => void;
  onGaps: (value: boolean) => void;
  onStart: () => void;
}) {
  const activeSubject =
    catalog.subjects.find((item) => item.id === subject) ?? catalog.subjects[0]!;
  const activePreset = catalog.presets.find((item) => item.id === preset) ?? catalog.presets[2]!;

  return (
    <section className="animate-rise pt-6 sm:pt-8">
      <div className="sm:flex sm:items-end sm:justify-between sm:gap-8">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-navy uppercase">
            <span className="h-px w-6 bg-navy" aria-hidden="true" />
            Three courses, timed
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.02] tracking-tight text-ink sm:text-6xl">
            Sit the paper<span className="text-rust">.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Pick a course, set the clock, and test yourself under exam conditions. Correct answers
            stay hidden until you submit.
          </p>
        </div>
        <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-line pt-4 sm:mt-0 sm:shrink-0 sm:border-0 sm:pt-0">
          <Stat label="Questions" value={totalQuestions} />
          <Stat label="Courses" value={catalog.subjects.length} />
          <Stat label="Lengths" value={catalog.presets.length} />
        </dl>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="grid min-w-0 gap-8">
          <section aria-labelledby="course-heading">
            <SectionHeading
              id="course-heading"
              step="01"
              title="Choose a course"
              hint="Each paper is drawn at random from the full question bank."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {catalog.subjects.map((item) => {
                const selected = item.id === subject;
                const Icon = SUBJECT_ICONS[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSubject(item.id)}
                    className={
                      "group relative flex flex-col rounded-card border p-4 text-left transition-all duration-200 sm:p-5 " +
                      (selected
                        ? "border-navy bg-navy text-card shadow-lift"
                        : "border-line bg-card text-ink shadow-card hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift")
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={
                          "flex size-10 items-center justify-center rounded-inner transition-colors " +
                          (selected ? "bg-card/10 text-card" : "bg-navy-soft text-navy")
                        }
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      {selected ? (
                        <span className="flex size-6 items-center justify-center rounded-full bg-rust text-card">
                          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted opacity-0 transition-opacity group-hover:opacity-100">
                          Select
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        "mt-4 block text-xs font-semibold tracking-[0.12em] uppercase " +
                        (selected ? "text-navy-muted" : "text-rust")
                      }
                    >
                      {item.code}
                    </span>
                    <span className="mt-1 block font-display text-xl leading-tight">
                      {item.title}
                    </span>
                    <span
                      className={
                        "mt-2 block text-sm leading-relaxed " +
                        (selected ? "text-navy-muted" : "text-muted")
                      }
                    >
                      {item.blurb}
                    </span>
                    <span
                      className={
                        "mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-xs " +
                        (selected ? "border-card/15 text-navy-muted" : "border-line text-muted")
                      }
                    >
                      <span>{item.english} standard</span>
                      <span>{item.gaps} fill-in-the-gap</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="length-heading">
            <SectionHeading
              id="length-heading"
              step="02"
              title="Set the length"
              hint="Shorter papers are best for a quick check. The full paper runs the clock."
            />
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {catalog.presets.map((item) => {
                const selected = item.id === preset;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPreset(item.id)}
                    className={
                      "flex min-h-24 flex-col rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 " +
                      (selected
                        ? "border-navy bg-navy-soft ring-1 ring-navy"
                        : "border-line bg-card shadow-card hover:-translate-y-0.5 hover:border-line-strong")
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{item.label}</span>
                      {selected ? (
                        <Check
                          className="size-4 shrink-0 text-rust"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="mt-auto flex items-baseline gap-1 pt-3">
                      <span className="font-display text-2xl leading-none text-navy tabular-nums">
                        {item.questions}
                      </span>
                      <span className="text-xs text-muted">questions</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {item.minutes} min
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="mix-heading">
            <SectionHeading
              id="mix-heading"
              step="03"
              title="Question mix"
              hint="Standard items have four options. Fill-in-the-gap items ask you to complete a sentence."
            />
            <div className="mt-4 flex items-center justify-between gap-4 rounded-card border border-line bg-card p-4 shadow-card sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-inner bg-navy-soft text-navy">
                  <TextCursorInput className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Fill-in-the-gap questions</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    Mix {activeSubject.gaps} cloze items into this paper.
                  </p>
                  <p className="mt-2 text-xs font-medium text-navy">
                    {available} questions in this mix
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeGaps}
                aria-label="Include fill-in-the-gap questions"
                onClick={() => onGaps(!includeGaps)}
                className="relative inline-flex h-11 w-14 shrink-0 items-center rounded-full"
              >
                <span
                  className={
                    "absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 rounded-full transition-colors " +
                    (includeGaps ? "bg-navy" : "bg-line-strong")
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    "relative size-5 rounded-full bg-card shadow-sm transition-transform " +
                    (includeGaps ? "translate-x-8" : "translate-x-1")
                  }
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>
        </div>

        <PaperSummary
          subject={activeSubject}
          preset={activePreset}
          includeGaps={includeGaps}
          presetFits={presetFits}
          busy={busy}
          error={error}
          onStart={onStart}
        />
      </div>

      <section className="mt-8 rounded-card border border-line bg-card/70 p-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">The routine</p>
        <ol className="mt-3 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, position) => (
            <li key={step.title} className="flex gap-3">
              <span className="font-display text-2xl leading-none text-rust tabular-nums">
                {String(position + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-l border-line pl-3 first:border-0 first:pl-0 sm:pl-4">
      <dt className="text-xs font-medium tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-2xl leading-none text-navy tabular-nums sm:text-3xl">
        {value}
      </dd>
    </div>
  );
}

function SectionHeading({
  id,
  step,
  title,
  hint,
}: {
  id: string;
  step: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-xs font-semibold text-navy tabular-nums">
        {step}
      </span>
      <div>
        <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-0.5 max-w-lg text-sm leading-relaxed text-muted">{hint}</p>
      </div>
    </div>
  );
}

function PaperSummary({
  subject,
  preset,
  includeGaps,
  presetFits,
  busy,
  error,
  onStart,
}: {
  subject: Subject;
  preset: Preset;
  includeGaps: boolean;
  presetFits: boolean;
  busy: boolean;
  error: string;
  onStart: () => void;
}) {
  const secondsEach = Math.round((preset.minutes * 60) / preset.questions);
  return (
    <aside className="mx-auto w-full rounded-card border border-line bg-card p-5 shadow-lift md:max-w-xl xl:sticky xl:top-6 xl:mx-0 xl:max-w-none">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Your paper</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-soft px-2.5 py-1 text-xs font-medium text-navy">
          <Timer className="size-3.5" aria-hidden="true" />
          Timed
        </span>
      </div>

      <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-rust uppercase">
        {subject.code}
      </p>
      <h2 className="mt-1 font-display text-2xl leading-snug text-ink">{subject.title}</h2>

      <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
        <SummaryRow label="Length" value={`${preset.questions} questions`} />
        <SummaryRow label="Clock" value={`${preset.minutes} minutes`} />
        <SummaryRow label="Mix" value={includeGaps ? "Standard + gap" : "Standard only"} />
        <SummaryRow label="Pace" value={`~${secondsEach}s a question`} />
      </dl>

      {error ? (
        <p
          className="mt-4 rounded-inner border border-rust/20 bg-rust-soft px-3 py-2.5 text-sm leading-relaxed text-rust"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {!presetFits ? (
        <p className="mt-4 rounded-inner border border-rust/20 bg-rust-soft px-3 py-2.5 text-sm leading-relaxed text-rust">
          That paper is longer than the questions available. Shorten it, or include fill-in-the-gap
          items.
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || !presetFits}
        onClick={onStart}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-inner bg-rust px-5 font-semibold text-card transition hover:bg-rust-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Opening paper…
          </>
        ) : (
          <>
            Start paper
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-navy" aria-hidden="true" />
        Correct answers stay hidden until you submit. Unanswered questions count as wrong.
      </p>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function formatTime(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function Exam({
  paper,
  presetLabel,
  answers,
  index,
  left,
  busy,
  error,
  confirming,
  onPick,
  onIndex,
  onAskSubmit,
  onCancelSubmit,
  onSubmit,
}: {
  paper: Paper;
  presetLabel: string;
  answers: (number | null)[];
  index: number;
  left: number;
  busy: boolean;
  error: string;
  confirming: boolean;
  onPick: (choice: number) => void;
  onIndex: (index: number) => void;
  onAskSubmit: () => void;
  onCancelSubmit: () => void;
  onSubmit: () => void;
}) {
  const question = paper.questions[index];
  const answered = answers.filter((choice) => choice !== null).length;
  const unanswered = paper.questions.length - answered;
  const urgent = left < 60;
  const total = paper.questions.length;
  const progress = total === 0 ? 0 : ((index + 1) / total) * 100;

  const keys = useMemo(() => ["A", "B", "C", "D"], []);
  const mobilePalette = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mobilePalette.current;
    if (!container) return;
    const chip = container.querySelector<HTMLElement>('[aria-current="true"]');
    if (!chip) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chip.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (confirming || busy) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndex(Math.min(paper.questions.length - 1, index + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndex(Math.max(0, index - 1));
      }
      const choice = ["1", "2", "3", "4"].indexOf(event.key);
      if (choice >= 0) onPick(choice);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, confirming, index, onIndex, onPick, paper.questions.length]);

  if (!question) return null;

  return (
    <section className="animate-rise">
      <div
        className="sticky top-0 z-20 -mx-4 border-b border-line/90 bg-paper/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-[0.14em] text-navy uppercase">
              {paper.code} · {presetLabel}
            </p>
            <p className="truncate text-sm font-medium text-ink">{paper.title}</p>
          </div>

          <div className="ml-auto hidden items-center gap-2.5 sm:flex">
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-label="Paper progress"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={index + 1}
            >
              <div
                className="h-full rounded-full bg-navy transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted tabular-nums">
              {index + 1} / {total}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-4">
            <TimerRing left={left} total={paper.seconds} urgent={urgent} />
            <div className="text-right">
              <p
                className={
                  "font-display text-xl leading-none tabular-nums " +
                  (urgent ? "text-rust" : "text-navy")
                }
                role="timer"
              >
                {formatTime(left)}
              </p>
              <p className="mt-0.5 text-xs tracking-wider text-muted uppercase">Left</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="grid min-w-0 gap-4">
          <article className="rounded-card border border-line bg-card p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                Question {index + 1} of {total}
              </span>
              {question.gap ? (
                <span className="rounded-full border border-rust/20 bg-rust-soft px-2.5 py-1 text-xs font-semibold text-rust">
                  Fill in the gap
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-xl leading-snug text-ink sm:text-2xl">
              {question.prompt}
            </h2>

            <div className="mt-6 grid gap-2.5" role="group" aria-label="Answer choices">
              {question.options.map((option, optionIndex) => {
                const selected = answers[index] === optionIndex;
                return (
                  <button
                    key={`${question.id}-${optionIndex}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPick(optionIndex)}
                    className={
                      "flex min-h-12 items-start gap-3 rounded-inner border px-4 py-3.5 text-left transition-all duration-150 " +
                      (selected
                        ? "border-navy bg-navy text-card shadow-card"
                        : "border-line bg-paper-soft text-ink hover:border-navy-mid hover:bg-navy-soft/60")
                    }
                  >
                    <span
                      className={
                        "flex size-8 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold " +
                        (selected
                          ? "border-card/25 bg-card/10 text-card"
                          : "border-line bg-card text-navy")
                      }
                      aria-hidden="true"
                    >
                      {keys[optionIndex]}
                    </span>
                    <span className="min-w-0 flex-1 pt-1 text-base leading-relaxed">{option}</span>
                    {selected ? (
                      <Check
                        className="mt-1.5 size-4 shrink-0 text-card"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </article>

          <div className="min-w-0 lg:hidden">
            <div
              ref={mobilePalette}
              className="flex w-full max-w-full gap-2 overflow-x-auto px-1 pb-1"
              aria-label="Question palette"
            >
              {paper.questions.map((item, position) => (
                <PaletteChip
                  key={item.id}
                  position={position}
                  current={position === index}
                  done={answers[position] !== null}
                  onClick={() => onIndex(position)}
                />
              ))}
            </div>
          </div>

          {error ? (
            <p
              className="rounded-inner border border-rust/20 bg-rust-soft px-4 py-3 text-sm text-rust"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-inner border border-line bg-card px-4 font-medium text-ink transition hover:border-line-strong hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onIndex(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-inner border border-line bg-card px-4 font-medium text-ink transition hover:border-line-strong hover:bg-paper-soft disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onIndex(Math.min(total - 1, index + 1))}
              disabled={index === total - 1}
            >
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-inner bg-rust px-5 font-semibold text-card transition hover:bg-rust-deep disabled:opacity-60 sm:col-span-1 sm:ml-auto"
              onClick={onAskSubmit}
              disabled={busy}
            >
              Submit paper
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
            <span>
              <span className="font-semibold text-ink tabular-nums">{answered}</span> answered
            </span>
            <span className="size-1 rounded-full bg-line-strong" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink tabular-nums">{unanswered}</span> open
            </span>
            <span className="ml-auto hidden items-center gap-1.5 sm:flex">
              <kbd className="rounded-md border border-line bg-card px-1.5 py-0.5 font-sans text-xs font-medium text-ink">
                1–4
              </kbd>
              choose
              <kbd className="rounded-md border border-line bg-card px-1.5 py-0.5 font-sans text-xs font-medium text-ink">
                ← →
              </kbd>
              move
            </span>
          </div>
        </div>

        <aside className="hidden self-start rounded-card border border-line bg-card p-4 shadow-card lg:sticky lg:top-24 lg:block">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Question map
            </p>
            <span className="text-xs text-muted tabular-nums">
              {answered}/{total}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {paper.questions.map((item, position) => (
              <PaletteChip
                key={item.id}
                position={position}
                current={position === index}
                done={answers[position] !== null}
                onClick={() => onIndex(position)}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-1.5 border-t border-line pt-3 text-xs text-muted">
            <Legend className="bg-navy" label="Current" />
            <Legend className="border border-navy/30 bg-navy-soft" label="Answered" />
            <Legend className="border border-line bg-card" label="Still open" />
          </div>
        </aside>
      </div>

      {confirming ? (
        <Modal labelledBy="exam-submit-title" onClose={onCancelSubmit}>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-inner bg-rust-soft text-rust">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="exam-submit-title" className="font-display text-2xl text-ink">
                Submit now?
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {unanswered === 0
                  ? "Every question has an answer. You will only see your percentage and the ones you missed."
                  : `${unanswered} question${unanswered === 1 ? "" : "s"} still unanswered. Those count as wrong.`}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              autoFocus
              className="min-h-12 rounded-inner border border-line bg-card px-4 font-medium text-ink transition hover:border-line-strong hover:bg-paper-soft"
              onClick={onCancelSubmit}
            >
              Keep working
            </button>
            <button
              type="button"
              className="min-h-12 rounded-inner bg-rust px-4 font-semibold text-card transition hover:bg-rust-deep disabled:opacity-60"
              onClick={onSubmit}
              disabled={busy}
            >
              {busy ? "Marking…" : "Submit"}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function TimerRing({ left, total, urgent }: { left: number; total: number; urgent: boolean }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;

  return (
    <svg viewBox="0 0 40 40" className="size-9 -rotate-90" aria-hidden="true">
      <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="3" className="stroke-line" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        className={
          "transition-[stroke-dashoffset] duration-500 " + (urgent ? "stroke-rust" : "stroke-navy")
        }
      />
    </svg>
  );
}

function PaletteChip({
  position,
  current,
  done,
  onClick,
}: {
  position: number;
  current: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      aria-label={`Question ${position + 1}${done ? ", answered" : ", still open"}`}
      className={
        "flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-colors " +
        (current
          ? "border-navy bg-navy text-card shadow-card"
          : done
            ? "border-navy/30 bg-navy-soft text-navy hover:border-navy"
            : "border-line bg-card text-muted hover:border-line-strong hover:text-ink")
      }
    >
      {position + 1}
    </button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={"size-3 rounded-[4px] " + className} aria-hidden="true" />
      {label}
    </span>
  );
}

function Result({
  grade,
  paper,
  usedSeconds,
  onAgain,
}: {
  grade: Grade;
  paper: Paper;
  usedSeconds: number;
  onAgain: () => void;
}) {
  const band = gradeBand(grade.percent);
  return (
    <section className="animate-rise grid gap-6 pt-6 sm:pt-8">
      <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
        <div className="grid sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center justify-center border-b border-line bg-paper-soft/70 p-6 sm:border-r sm:border-b-0 sm:p-8">
            <ScoreDial percent={grade.percent} />
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.16em] text-rust uppercase">
              {paper.code} · {paper.title}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
              {band.label}
            </h1>
            <p className="mt-2 max-w-md leading-relaxed text-muted">{band.copy}</p>

            <dl className="mt-6 grid grid-cols-3 gap-2.5">
              <ResultStat label="Correct" value={grade.correct} tone="ok" />
              <ResultStat label="Missed" value={grade.wrong.length} tone="rust" />
              <ResultStat label="Time used" value={formatTime(usedSeconds)} tone="navy" />
            </dl>

            <button
              type="button"
              onClick={onAgain}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-inner bg-navy px-5 font-semibold text-card transition hover:bg-navy-deep sm:w-auto"
            >
              Sit another paper
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper-soft px-6 py-3 text-xs text-muted">
          <span>
            {paper.questions.length} questions · {paper.minutes} minute clock
          </span>
          <span>Marked on submit</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Review</h2>
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-muted">
            {grade.wrong.length} missed
          </span>
        </div>

        {grade.wrong.length === 0 ? (
          <div className="mt-3 flex items-start gap-3 rounded-card border border-ok/20 bg-ok-soft p-5">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ok">Clean paper.</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ok/80">
                Every answer was right. Sit a longer paper or another course to keep going.
              </p>
            </div>
          </div>
        ) : (
          <ol className="mt-3 grid gap-2.5">
            {grade.wrong.map((item, position) => (
              <li
                key={item.prompt}
                className="rounded-card border border-line bg-card p-4 shadow-card sm:p-5"
              >
                <div className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rust-soft text-xs font-semibold text-rust tabular-nums">
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-ink">{item.prompt}</p>
                      {item.gap ? (
                        <span className="shrink-0 rounded-full bg-rust-soft px-2.5 py-0.5 text-xs font-semibold text-rust">
                          Fill in the gap
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      <p className="rounded-inner border border-rust/15 bg-rust-soft px-3 py-2 text-sm leading-relaxed text-rust">
                        <span className="font-semibold">Your answer · </span>
                        {item.yourAnswer}
                      </p>
                      <p className="rounded-inner border border-ok/15 bg-ok-soft px-3 py-2 text-sm leading-relaxed text-ok">
                        <span className="font-semibold">Correct · </span>
                        {item.correctAnswer}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: "ok" | "rust" | "navy";
}) {
  const color = tone === "ok" ? "text-ok" : tone === "rust" ? "text-rust" : "text-navy";
  return (
    <div className="rounded-inner border border-line bg-paper-soft/70 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={"mt-1 font-display text-xl leading-none tabular-nums " + color}>{value}</dd>
    </div>
  );
}

function ScoreDial({ percent }: { percent: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative flex size-36 items-center justify-center sm:size-40">
      <svg
        viewBox="0 0 120 120"
        className="size-full -rotate-90"
        role="img"
        aria-label={`Score: ${percent} percent`}
      >
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="9" className="stroke-line" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safe / 100)}
          className={
            "transition-[stroke-dashoffset] duration-700 " +
            (safe >= 50 ? "stroke-navy" : "stroke-rust")
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl leading-none text-ink tabular-nums">{percent}%</span>
        <span className="mt-1.5 text-xs font-medium tracking-[0.14em] text-muted uppercase">
          Marked
        </span>
      </div>
    </div>
  );
}

function gradeBand(percent: number) {
  if (percent >= 85) {
    return {
      label: "Distinction",
      copy: "A confident paper. Keep this pace and try the full length next.",
    };
  }
  if (percent >= 70) {
    return {
      label: "Strong pass",
      copy: "A solid grasp of the material. Review the misses and go again.",
    };
  }
  if (percent >= 50) {
    return {
      label: "Pass",
      copy: "You are through the paper. Tighten the gaps in the review below.",
    };
  }
  return {
    label: "Keep practising",
    copy: "Use the review below, then sit a shorter paper to build momentum.",
  };
}

function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-navy-deep/45 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-float sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
