# LevelUp Engineer

A knowledge base and interview-prep app for senior engineers and architects moving towards Staff, Principal, Architect and Engineering Manager roles.

Content lives in Markdown under [`content/`](content/). A build-time pipeline checks and compiles it into JSON, which the React app loads one topic at a time.

## Getting started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:5173 — recompiles content on save
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server; content errors show in the terminal and browser overlay |
| `npm run content` | Compile and validate `content/` → `src/generated/` (lists every error and warning) |
| `npm run build` | Content + type-check + production build into `dist/` |
| `npm test` | Unit and component tests (Vitest) |
| `npm run typecheck` | Content + `tsc -b` |

## Project structure

```
content/                 Topic Markdown, groups.json, paths.json, _template.md
docs/prompts/            Prompt for generating topic content
scripts/content/         Build-time pipeline: parse, validate, render to JSON (+ tests)
src/
  app/                   Router, layout, sidebar, error pages
  components/            Shared UI (badges, prose, theme toggle)
  features/              One folder per feature (dashboard, catalogue, topic, …)
  lib/content/           Content schema (shared with the pipeline) and loaders
  generated/             Pipeline output (gitignored)
```

## Adding or updating a topic

1. Every topic already has a stub at `content/<group>/<id>.md`. To add a brand-new one, copy [`content/_template.md`](content/_template.md); the file name must equal `id` and the folder must equal `group`.
2. Write the content by hand or generate it with [`docs/prompts/generate-topic.md`](docs/prompts/generate-topic.md).
3. Run `npm run content` and fix what it reports.

**Statuses:**
- `stub`: no content; shown as "coming soon".
- `draft`: missing pieces are warnings.
- `complete`: missing pieces are errors, and the question mix (4 Foundation / 6 Senior / 5 Architect) is checked.

**The format rules the pipeline enforces:**
- The nine `##` section headings from the template, and no others.
- Interview questions as `### Question? {#stable-id}` with **Level**, **Model answer**, **What the interviewer is looking for**, **Follow-ups** and **Red flags** fields. The `{#id}` keys review history, so keep it when you reword a question.
- Cheat-sheet bullets as `- **Front** — back`. Each one becomes a flashcard.
- Diagrams as ```` ```mermaid ```` code blocks.
- Plain Markdown only. Raw HTML is stripped, and `.mdx` files are rejected.
- `related` topic ids and every topic in `paths.json` must exist.

Put `VERIFY:` in front of any claim that still needs checking. The topic page shows how many remain.

## Deployment

Azure Static Web Apps via GitHub Actions. This arrives in phase 5.
