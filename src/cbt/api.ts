import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const subjectSchema = z.enum(["oop", "excel", "word"]);
const presetSchema = z.enum(["sprint", "drill", "standard", "paper", "marathon"]);

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { BANK, PRESETS, SUBJECTS } = await import("./bank.server");
  return {
    subjects: SUBJECTS.map((subject) => {
      const rows = BANK.filter((item) => item.subject === subject.id);
      return {
        ...subject,
        english: rows.filter((item) => !item.gap).length,
        gaps: rows.filter((item) => item.gap).length,
      };
    }),
    presets: PRESETS.map((preset) => ({ ...preset })),
  };
});

export const startPaper = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subject: subjectSchema,
      preset: presetSchema,
      includeGaps: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { BANK, PRESETS, SUBJECTS } = await import("./bank.server");
    const preset = PRESETS.find((item) => item.id === data.preset);
    if (!preset) throw new Error("Unknown paper length.");
    const available = BANK.filter(
      (item) => item.subject === data.subject && (data.includeGaps || !item.gap),
    );
    if (available.length < preset.questions) {
      throw new Error(
        `Only ${available.length} questions are available for that mix. Pick a shorter paper or include fill-in-the-gap questions.`,
      );
    }
    const subject = SUBJECTS.find((item) => item.id === data.subject);
    const pool = [...available];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      const current = pool[index];
      pool[index] = pool[swap]!;
      pool[swap] = current!;
    }
    const chosen = pool.slice(0, preset.questions);
    return {
      subject: data.subject,
      code: subject?.code ?? "",
      title: subject?.title ?? "",
      preset: preset.id,
      minutes: preset.minutes,
      seconds: preset.minutes * 60,
      questions: chosen.map((item) => ({
        id: item.id,
        prompt: item.prompt,
        options: [...item.options] as [string, string, string, string],
        gap: item.gap,
      })),
    };
  });

export const gradePaper = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subject: subjectSchema,
      answers: z
        .array(
          z.object({
            id: z.string().min(1).max(40),
            choice: z.number().int().min(0).max(3).nullable(),
          }),
        )
        .min(1)
        .max(80),
    }),
  )
  .handler(async ({ data }) => {
    const { BANK } = await import("./bank.server");
    const byId = new Map(BANK.map((item) => [item.id, item]));
    const seen = new Set<string>();
    let correct = 0;
    const wrong: {
      prompt: string;
      gap: boolean;
      yourAnswer: string;
      correctAnswer: string;
    }[] = [];

    for (const answer of data.answers) {
      if (seen.has(answer.id)) continue;
      seen.add(answer.id);
      const item = byId.get(answer.id);
      if (!item || item.subject !== data.subject) {
        throw new Error("This paper contains a question that is not on the syllabus.");
      }
      const picked = answer.choice === null ? null : item.options[answer.choice];
      if (answer.choice === item.answer) {
        correct += 1;
      } else {
        wrong.push({
          prompt: item.prompt,
          gap: item.gap,
          yourAnswer: picked ?? "Unanswered",
          correctAnswer: item.options[item.answer],
        });
      }
    }

    const total = seen.size;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    return { total, correct, percent, wrong };
  });
