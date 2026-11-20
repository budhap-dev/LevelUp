# Prompt: generate the content for one topic

Use this to write or upgrade a topic file. Paste it into your LLM of choice with `content/_template.md` attached (or pasted below the prompt). Save the result to `content/<group>/<id>.md`, then run `npm run content` and fix anything it reports.

The stub files already contain the correct `id`, `group`, `tags`, `level`, `estimatedMinutes` and `related` values. Paste the stub's frontmatter in too, so the model keeps them.

---

```text
You are a principal engineer and technical interviewer with 20+ years of experience. Write the content file for the topic "<TOPIC TITLE>" (id: <topic-id>, group: <group-id>) for my LevelUp Engineer app.

Audience: a senior engineer with 18 years of experience moving towards Staff/Architect/Leadership roles. Skip beginner padding. Focus on depth, trade-offs, the reasoning behind decisions, and what separates a senior answer from an architect answer.

FORMAT — the app parses this file, so follow the attached template EXACTLY:
- Output one Markdown (.md) file. Plain GitHub-flavoured Markdown only: no MDX/JSX, no raw HTML.
- Keep the frontmatter I give you; set lastReviewed to <TODAY YYYY-MM-DD> and status to complete.
- Use exactly these nine H2 headings, in this order:
  ## TL;DR
  ## Core Concepts
  ## How It Works
  ## When to Use / Trade-offs
  ## Common Pitfalls & Anti-patterns
  ## Real-world Scenario
  ## Interview Questions
  ## Cheat Sheet
  ## Further Reading
- Use H3 (###) and below for sub-headings inside sections.
- Diagrams: fenced code blocks with language "mermaid". Wrap node labels containing punctuation in double quotes, e.g. A["Client (browser)"]. Never use semicolons inside sequence-diagram message text (Mermaid treats them as statement ends).
- Code examples: fenced blocks with a language; TypeScript where relevant.

CONTENT:
- TL;DR: 3–5 bullets.
- Core Concepts: explanations with code samples.
- How It Works: at least one Mermaid diagram.
- When to Use / Trade-offs: a comparison table.
- Real-world Scenario: context, decision, outcome, what you'd do differently.
- Further Reading: official documentation only (or the canonical primary source for non-technical topics), as Markdown links with a one-line reason.

INTERVIEW QUESTIONS — 15 in total: 4 Foundation, 6 Senior, 5 Architect; at least 3 scenario or system-design questions ("How would you design…", "Your team is facing…"). Each question uses exactly this shape:

### <Question text>? {#short-kebab-case-id}

**Level:** Foundation | Senior | Architect

**Model answer:**
<concise but complete; paragraphs, lists, code allowed>

**What the interviewer is looking for:**
<what separates a good answer from a great one>

**Follow-ups:**
- <2–3 likely follow-up questions>

**Red flags:**
- <answers that should worry the interviewer>

The {#id} must be unique within the file and should not change if the question is reworded later.

CHEAT SHEET — 10–15 bullets, every one in the form:
- **Term or question** — one-line answer.
(Each bullet becomes a flashcard: bold front, text after the dash is the back.) You may group bullets under ### sub-headings.

RULES:
- Be accurate and current; say when something is deprecated or has changed recently, with the version or year.
- Prefer concrete examples (numbers, real products, real failure modes) over generic statements.
- If you are not sure of a fact, prefix it with "VERIFY:" so I can check it. Do not invent URLs; if unsure of a link, prefix the bullet with "VERIFY:".
```

---

## Upgrading a draft

For a topic that's already `status: draft`, use the same prompt, but paste the existing file instead of the stub's frontmatter and add this paragraph at the end of the prompt:

```text
Here is the existing draft. Keep its sections and improve them rather than starting again. Keep every existing interview question, and keep its {#id} EXACTLY as it is, even if you reword the question. Add new questions, each with a new unique {#id}, until the mix is 4 Foundation, 6 Senior and 5 Architect (15 in total). Keep every existing cheat-sheet bullet's bold front text unchanged, and add more bullets up to 10–15. Set status to complete.
```

Why it matters: your Interview-mode review history is keyed on each question's `{#id}`, and each flashcard is identified by its front text. If either changes, that card's history resets to new.

Before you save, compare the old and new files (for example with `git diff`) and check that no `{#id}` was removed or renamed.

## After generating

1. Save to `content/<group>/<id>.md`.
2. Run `npm run content`. Errors block the build; warnings tell you what's below the bar (question mix, missing follow-ups, cheat-sheet bullets that won't become flashcards).
3. Search for `VERIFY:` and check each claim against the official docs. Remove the marker once verified. The topic page shows how many remain.
4. Read the interview answers critically. Where you disagree or the model is shallow, rewrite it. That's where the learning is.
