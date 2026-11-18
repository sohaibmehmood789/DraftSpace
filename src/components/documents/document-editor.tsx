"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { editorExtensions } from "@/lib/documents/schema";
import { ShareDialog } from "./share-dialog";
import { useDocumentSave } from "./use-document-save";

type Document = { id: string; title: string; content: JSONContent; updated_at: string };

function EditorFooter({ editor }: { editor: Editor }) {
  const words = useEditorState({ editor, selector: ({ editor }) => {
    const text = editor.getText().trim();
    return text ? text.split(/\s+/).length : 0;
  } });
  return <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
    <span>{words} {words === 1 ? "word" : "words"}</span><span>Changes save automatically</span>
  </footer>;
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
    bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"),
    heading: editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p",
    undo: editor.can().undo(), redo: editor.can().redo(),
  }) });
  const controls = [
    { label: "Bold", text: "B", active: state.bold, className: "font-bold", run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", text: "I", active: state.italic, className: "italic", run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", text: "U", active: state.underline, className: "underline", run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Bulleted list", text: "• List", active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", text: "1. List", active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
  ];
  return <div aria-label="Formatting options" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
    <select aria-label="Text style" value={state.heading} onChange={(event) => {
      if (event.target.value === "p") editor.chain().focus().setParagraph().run();
      else editor.chain().focus().setHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 }).run();
    }} className="mr-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus-visible:outline-indigo-600">
      <option value="p">Normal text</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
    </select>
    {controls.map((control) => <button key={control.label} type="button" aria-label={control.label} title={control.label} aria-pressed={control.active}
      onMouseDown={(event) => event.preventDefault()} onClick={control.run}
      className={`min-w-9 rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600 ${control.active ? "bg-indigo-100 text-indigo-800" : "text-slate-700 hover:bg-slate-100"} ${control.className ?? ""}`}>{control.text}</button>)}
    <span aria-hidden="true" className="mx-2 h-5 border-l border-slate-200" />
    <button type="button" aria-label="Undo" title="Undo" disabled={!state.undo} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().undo().run()} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30">↶</button>
    <button type="button" aria-label="Redo" title="Redo" disabled={!state.redo} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().redo().run()} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30">↷</button>
  </div>;
}

export function DocumentEditor({ document, isOwner }: { document: Document; isOwner: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(document.title);
  const [shareOpen, setShareOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { status, error, conflict, change, save } = useDocumentSave(document);
  const editor = useEditor({
    extensions: editorExtensions(),
    content: document.content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Document content", "aria-multiline": "true", spellcheck: "true", class: "document-content" } },
    onUpdate: ({ editor }) => change({ content: editor.getJSON() }),
  });

  async function backToDocuments() {
    setLeaving(true);
    if (await save()) {
      router.push("/documents");
      router.refresh();
    } else setLeaving(false);
  }

  return <div className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
        <button type="button" disabled={leaving} onClick={() => { void backToDocuments(); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60">← All documents</button>
        <div className="min-w-40 flex-1">
          <label htmlFor="document-title" className="sr-only">Document title</label>
          <input id="document-title" value={title} maxLength={200} onChange={(event) => { setTitle(event.target.value); change({ title: event.target.value }); }}
            className="w-full rounded-md border border-transparent px-2 py-1.5 text-lg font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          <p className="px-2 text-xs text-slate-500">{isOwner ? "Owned by you" : "Shared with you · Can edit"}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span role="status" aria-live="polite" className={`text-xs ${status === "error" ? "text-red-600" : "text-slate-500"}`}>
            {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : status === "error" ? "Save failed" : "Unsaved changes"}
          </span>
          {isOwner && <button type="button" disabled={!editor || status === "saving" || conflict} onClick={async () => { if (await save()) setShareOpen(true); }}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60">Share</button>}
          <button type="button" disabled={!editor || status === "saving" || conflict} onClick={() => { void save(); }} title="Save (Ctrl/⌘ + S)"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">Save</button>
        </div>
      </div>
    </header>
    {shareOpen && <ShareDialog documentId={document.id} onClose={() => setShareOpen(false)} />}
    {error && <div role="alert" className="mx-auto mt-4 max-w-4xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
    <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {editor ? <Toolbar editor={editor} /> : <p role="status" className="p-4 text-sm text-slate-500">Loading editor…</p>}
        <EditorContent editor={editor} />
        {editor && <EditorFooter editor={editor} />}
      </div>
    </main>
  </div>;
}
