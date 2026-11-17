# Paper Hall

Timed CSC practice papers for **Object-oriented programming (CSC 392)**, **Microsoft Excel (CSC 394)**, and **Microsoft Word (CSC 396)**.

Pick a course and a paper length, sit the clock, and review the questions you missed. Answers stay hidden until you submit.

## What's inside

- **265 questions** across three courses, with standard multiple-choice and fill-in-the-gap items
- **Five paper lengths** from a 15-question sprint to a 70-question marathon
- **Exam mode** with a countdown timer, question map, answer progress, and keyboard shortcuts
- **Results** with a score dial, time used, and a review of every missed answer
- **Responsive UI** built on a warm paper-and-ink design system with Fraunces and Outfit

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19
- Tailwind CSS v4 (design tokens in `src/styles.css`)
- Lucide icons
- TypeScript

## Run locally

```bash
npm install
npm run dev
```

The app is served on `http://localhost:8080`.

Useful scripts:

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # production build
```

## Structure

```
src/routes/index.tsx   # lobby, exam, and results
src/cbt/api.ts         # server functions for papers and marking
src/cbt/bank.server.ts # question bank, courses, and paper lengths
src/styles.css         # design tokens and base styles
public/                # favicon, share card, and PWA assets
```

## Deploy

The project builds for Vercel. `npm run build` produces the deployable output; the app has no database or auth requirement.

---

Designed by [TDG](http://thedesigngrandmaster.me/).
