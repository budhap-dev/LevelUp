/**
 * Notes from the terminal. Used to set up the database and by Claude to add notes on request.
 *
 *   npm run notes -- migrate                                    create/upgrade the tables
 *   npm run notes -- list [search words]                        newest first, or search results
 *   npm run notes -- show <id>                                  print one note as text
 *   npm run notes -- add --title "Title" [--body "markdown" | --file note.md] [--attach path]...
 *   npm run notes -- append <id> [--body "markdown" | --file more.md]
 *   npm run notes -- attach <id> <path>...
 *
 * Bodies are Markdown (GFM, including `- [ ]` checklists), converted to the editor's HTML.
 * Reads DATABASE_URL from the environment or .env.local.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import type { Element, Root } from 'hast';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { htmlToText, sanitizeNoteHtml } from '../../api/_lib/html.ts';
import { SCHEMA, createNeonRepo } from '../../api/_lib/repo.ts';
import { MAX_ATTACHMENT_BYTES, SNIPPET_MARK_END, SNIPPET_MARK_START } from '../../src/lib/notes/types.ts';
import { neon } from '@neondatabase/serverless';

/** GFM task lists → the markup TipTap's TaskList/TaskItem parse. */
function rehypeTipTapTasks() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== 'element') continue;
        const classes = ([] as unknown[]).concat(child.properties.className ?? []);
        if (child.tagName === 'ul' && classes.includes('contains-task-list')) {
          child.properties = { dataType: 'taskList' };
        } else if (child.tagName === 'li' && classes.includes('task-list-item')) {
          const box = child.children.find((c): c is Element => c.type === 'element' && c.tagName === 'input');
          child.properties = { dataType: 'taskItem', dataChecked: String(!!box?.properties.checked) };
          child.children = child.children.filter((c) => c !== box);
        }
        visit(child);
      }
    };
    visit(tree);
  };
}

export async function markdownToNoteHtml(markdown: string): Promise<string> {
  const html = String(
    await unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeTipTapTasks).use(rehypeStringify).process(markdown),
  );
  return sanitizeNoteHtml(html);
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
  '.json': 'application/json', '.csv': 'text/csv', '.zip': 'application/zip', '.html': 'text/html',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.DATABASE_URL ?? die('DATABASE_URL is not set (add it to .env.local or run `npx vercel env pull .env.local`).');
  const repo = createNeonRepo(url);

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: 'string' },
      body: { type: 'string' },
      file: { type: 'string' },
      attach: { type: 'string', multiple: true },
    },
  });
  const [command, ...args] = positionals;

  const readBody = () => (values.file ? readFileSync(values.file, 'utf8') : values.body);

  const attachFiles = async (noteId: string, paths: string[]) => {
    for (const path of paths) {
      const data = readFileSync(path);
      if (data.byteLength > MAX_ATTACHMENT_BYTES) die(`${path} is larger than 4 MB`);
      const a = await repo.addAttachment(noteId, {
        filename: basename(path),
        contentType: MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
        data: new Uint8Array(data),
      });
      if (!a) die(`Note ${noteId} not found`);
      console.log(`  attached ${a.filename} (${a.size} bytes)`);
    }
  };

  switch (command) {
    case 'migrate': {
      const sql = neon(url);
      for (const statement of SCHEMA) await sql.query(statement);
      console.log(`Schema up to date (${SCHEMA.length} statements).`);
      break;
    }
    case 'list': {
      const notes = await repo.list(args.join(' '));
      if (!notes.length) console.log('No notes.');
      for (const n of notes) {
        const snippet = n.snippet.replaceAll(SNIPPET_MARK_START, '[').replaceAll(SNIPPET_MARK_END, ']').replace(/\s+/g, ' ').slice(0, 100);
        console.log(`${n.id}  ${n.updatedAt.slice(0, 16).replace('T', ' ')}  ${n.title || 'Untitled'}${n.attachmentCount ? `  📎${n.attachmentCount}` : ''}\n    ${snippet}`);
      }
      break;
    }
    case 'show': {
      const note = (await repo.get(args[0] ?? die('Usage: show <id>'))) ?? die('Note not found');
      console.log(`# ${note.title || 'Untitled'}\n(updated ${note.updatedAt})\n\n${htmlToText(note.contentHtml)}`);
      for (const a of note.attachments) console.log(`📎 ${a.filename} (${a.contentType}, ${a.size} bytes)`);
      break;
    }
    case 'add': {
      if (!values.title) die('Usage: add --title "Title" [--body markdown | --file path.md] [--attach path]...');
      const html = await markdownToNoteHtml(readBody() ?? '');
      const note = await repo.create({ title: values.title.trim().slice(0, 300), contentHtml: html, contentText: htmlToText(html) });
      console.log(`Created ${note.id}  ${note.title}`);
      await attachFiles(note.id, values.attach ?? []);
      break;
    }
    case 'append': {
      const id = args[0] ?? die('Usage: append <id> [--body markdown | --file path.md]');
      const note = (await repo.get(id)) ?? die('Note not found');
      const html = note.contentHtml + (await markdownToNoteHtml(readBody() ?? die('Nothing to append: pass --body or --file')));
      await repo.update(id, { contentHtml: html, contentText: htmlToText(html) });
      console.log(`Appended to ${id}  ${note.title}`);
      await attachFiles(id, values.attach ?? []);
      break;
    }
    case 'attach': {
      const [id, ...paths] = args;
      if (!id || !paths.length) die('Usage: attach <id> <path>...');
      await attachFiles(id, paths);
      break;
    }
    default:
      die('Commands: migrate | list [query] | show <id> | add --title … | append <id> … | attach <id> <path>…');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
