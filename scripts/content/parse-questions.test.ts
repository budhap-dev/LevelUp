// @vitest-environment node
import { parseMarkdown } from './markdown.ts';
import { parseQuestions } from './parse-questions.ts';

const parse = (md: string) => parseQuestions('topic', parseMarkdown(md).children);

const FULL = `
Intro text is ignored.

### How does \`Promise.all\` fail? {#promise-all-failure}

**Level:** Senior

**Model answer:**
It rejects as soon as **any** input rejects.

\`\`\`ts
await Promise.all([a(), b()]);
\`\`\`

**What the interviewer is looking for:**
Knowing about \`allSettled\`.

**Follow-ups:**
- What about \`Promise.any\`?
- Cancellation?

**Red flags:**
- "It waits for all of them"
`;

describe('parseQuestions', () => {
  it('parses every field of a well-formed question', async () => {
    const { questions, problems } = await parse(FULL);
    expect(problems).toEqual([]);
    expect(questions).toHaveLength(1);
    const q = questions[0]!;
    expect(q.id).toBe('promise-all-failure');
    expect(q.question).toBe('How does Promise.all fail?');
    expect(q.level).toBe('Senior');
    expect(q.modelAnswerHtml).toContain('<strong>any</strong>');
    expect(q.modelAnswerHtml).toContain('class="shiki');
    expect(q.lookingForHtml).toContain('<code>allSettled</code>');
    expect(q.followUpsHtml).toEqual(['What about <code>Promise.any</code>?', 'Cancellation?']);
    expect(q.redFlagsHtml).toHaveLength(1);
  });

  it('accepts the colon outside the bold label and the value on the same line', async () => {
    const { questions, problems } = await parse(`
### Q? {#q}
**Level**: architect

**Model answer**: Short answer.

**What the interviewer is looking for**: Depth.
`);
    expect(questions[0]?.level).toBe('Architect');
    expect(questions[0]?.modelAnswerHtml).toBe('<p>Short answer.</p>');
    expect(problems.filter((p) => p.required)).toEqual([]);
  });

  it('does not treat a bold phrase without a colon as a field', async () => {
    const { questions } = await parse(`
### Q? {#q}
**Level:** Senior

**Model answer:**
First paragraph.

**Consistency** matters more than latency here.

**What the interviewer is looking for:**
X
`);
    expect(questions[0]?.modelAnswerHtml).toContain('<strong>Consistency</strong> matters');
  });

  it('reports missing required fields and drops the question', async () => {
    const { questions, problems } = await parse(`
### Q? {#q}
**Level:** Expert

**What the interviewer is looking for:**
X
`);
    expect(questions).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.required).toBe(true);
    expect(problems[0]?.message).toMatch(/valid Level \(got "Expert"/);
    expect(problems[0]?.message).toMatch(/Model answer/);
  });

  it('generates an id when missing and warns about it', async () => {
    const { questions, problems } = await parse(`
### What is the CAP theorem, really?
**Level:** Foundation

**Model answer:** A.

**What the interviewer is looking for:** B.
`);
    expect(questions[0]?.id).toBe('what-is-the-cap-theorem-really');
    expect(problems.some((p) => !p.required && /no \{#id\}/.test(p.message))).toBe(true);
  });

  it('rejects duplicate ids', async () => {
    const q = `**Level:** Senior\n\n**Model answer:** A\n\n**What the interviewer is looking for:** B\n`;
    const { questions, problems } = await parse(`### One {#same}\n${q}\n### Two {#same}\n${q}`);
    expect(questions).toHaveLength(1);
    expect(problems.some((p) => p.required && /duplicate question id "same"/.test(p.message))).toBe(true);
  });

  it('warns when follow-ups and red flags are missing', async () => {
    const { problems } = await parse(`### Q {#q}\n**Level:** Senior\n\n**Model answer:** A\n\n**What the interviewer is looking for:** B\n`);
    expect(problems.map((p) => p.message)).toEqual([
      expect.stringMatching(/no Follow-ups/),
      expect.stringMatching(/no Red flags/),
    ]);
  });
});
