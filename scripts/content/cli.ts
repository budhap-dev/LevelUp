/**
 * Compile /content into src/generated. Exits non-zero on content errors.
 *   npm run content             # build
 *   npm run content -- --quiet  # hide warnings
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, writeContent } from './pipeline.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const quiet = process.argv.includes('--quiet');

const started = performance.now();
const build = await buildContent(path.join(root, 'content'));
const { errors, warnings } = build.diagnostics;

const shown = quiet ? errors : build.diagnostics.items;
if (shown.length) console.log(build.diagnostics.format(shown));

if (errors.length) {
  console.error(`\n✖ content: ${errors.length} error(s), ${warnings.length} warning(s). Nothing written.`);
  process.exit(1);
}

await writeContent(path.join(root, 'src/generated'), build);

const counts = build.manifest.topics.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }), {});
const questions = build.topics.reduce((n, t) => n + t.questions.length, 0);
const cards = build.topics.reduce((n, t) => n + t.flashcards.length, 0);
const verify = build.manifest.topics.reduce((n, t) => n + t.verifyCount, 0);
console.log(
  `✔ content: ${build.topics.length} topics (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}), ` +
    `${questions} questions, ${cards} flashcards, ${verify} VERIFY marker(s), ${warnings.length} warning(s) ` +
    `in ${Math.round(performance.now() - started)}ms`,
);
