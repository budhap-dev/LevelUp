import { useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Icon, type IconName } from './icons';
import { CodeBlockWithDiagrams, Drawio, DrawioDialog, insertMermaid } from './diagrams';

interface Props {
  /** Initial HTML. The editor is uncontrolled: remount it (via `key`) to load a different note. */
  initialHtml: string;
  onChange: (html: string, text: string) => void;
  /** Files pasted or dropped into the editor. */
  onFiles?: (files: File[]) => void;
  label: string;
}

export function RichTextEditor({ initialHtml, onChange, onFiles, label }: Props) {
  // The editor is created once; read the latest callbacks through refs.
  const onChangeRef = useRef(onChange);
  const onFilesRef = useRef(onFiles);
  onChangeRef.current = onChange;
  onFilesRef.current = onFiles;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
      }),
      CodeBlockWithDiagrams,
      Drawio,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: initialHtml,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: 'prose max-w-none min-h-[40vh] py-4 focus:outline-none prose-pre:p-4 prose-p:my-2 prose-li:my-0.5',
        'aria-label': label,
        'aria-multiline': 'true',
        role: 'textbox',
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.length || !onFilesRef.current) return false;
        onFilesRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...((event as DragEvent).dataTransfer?.files ?? [])];
        if (!files.length || !onFilesRef.current) return false;
        event.preventDefault();
        onFilesRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(e.getHTML(), e.getText()),
  });

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="notes-editor" />
    </div>
  );
}

function ToolButton({ label, icon, active, disabled, onClick, children }: { label: string; icon?: IconName; active?: boolean; disabled?: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection: act on mousedown without stealing focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
        active ? 'bg-accent-soft text-accent-ink' : 'text-fg-soft hover:bg-subtle hover:text-fg'
      }`}
    >
      {icon ? <Icon name={icon} /> : children}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullets: e.isActive('bulletList'),
      numbers: e.isActive('orderedList'),
      tasks: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const [drawing, setDrawing] = useState(false);

  const editLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL (leave empty to remove)', previous ?? 'https://');
    if (href === null) return;
    if (!href.trim() || href.trim() === 'https://') chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-16 z-10 -mx-1 flex flex-wrap items-center gap-0.5 border-y border-line bg-canvas px-1 py-1"
    >
      <ToolButton label="Bold (⌘B)" icon="bold" active={s.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton label="Italic (⌘I)" icon="italic" active={s.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton label="Underline (⌘U)" icon="underline" active={s.underline} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton label="Strikethrough" icon="strike" active={s.strike} onClick={() => chain().toggleStrike().run()} />
      <ToolButton label="Inline code" icon="code" active={s.code} onClick={() => chain().toggleCode().run()} />
      <ToolButton label="Link" icon="link" active={s.link} onClick={editLink} />
      <Divider />
      <ToolButton label="Heading 1" active={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>H1</ToolButton>
      <ToolButton label="Heading 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>H2</ToolButton>
      <ToolButton label="Heading 3" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>H3</ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" icon="bullets" active={s.bullets} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton label="Numbered list" icon="numbers" active={s.numbers} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton label="Checklist" icon="tasks" active={s.tasks} onClick={() => chain().toggleTaskList().run()} />
      <ToolButton label="Quote" icon="quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton label="Code block" icon="codeBlock" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()} />
      <ToolButton label="Divider line" icon="rule" onClick={() => chain().setHorizontalRule().run()} />
      <Divider />
      <ToolButton label="Mermaid diagram" icon="flowchart" onClick={() => insertMermaid(editor)} />
      <ToolButton label="draw.io diagram" icon="shapes" onClick={() => setDrawing(true)} />
      {drawing && <DrawioDialog src={null} onSave={(src) => chain().insertDrawio(src).run()} onClose={() => setDrawing(false)} />}
      <Divider />
      <ToolButton label="Undo (⌘Z)" icon="undo" disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton label="Redo (⇧⌘Z)" icon="redo" disabled={!s.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}
