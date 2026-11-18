import { getSchema, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

export const EMPTY_DOCUMENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
export const MAX_CONTENT_BYTES = 500_000;

export function editorExtensions() {
  return [StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false, code: false, codeBlock: false, blockquote: false,
    horizontalRule: false, strike: false,
  })];
}

const schema = getSchema(editorExtensions());

export function validateTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
    throw new Error("Give your document a title between 1 and 200 characters.");
  }
  return value.trim();
}

export function validateContent(value: unknown): JSONContent {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    (value as JSONContent).type !== "doc" || !Array.isArray((value as JSONContent).content)) {
    throw new Error("The document content is invalid.");
  }
  // Bound traversal before asking ProseMirror to parse nested nodes.
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++count > 20_000 || item.depth > 40) throw new Error("This document is too complex to save.");
    if (item.value && typeof item.value === "object") {
      for (const child of Object.values(item.value)) stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_CONTENT_BYTES) {
    throw new Error("This document is too large. Keep its content under 500 KB.");
  }
  try {
    const node = schema.nodeFromJSON(value);
    node.check();
    // ProseMirror attrs may have a null prototype. React's server/client
    // boundary requires ordinary JSON objects.
    return JSON.parse(JSON.stringify(node.toJSON())) as JSONContent;
  } catch {
    throw new Error("The document contains unsupported formatting or invalid content.");
  }
}

export function isDocumentId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
