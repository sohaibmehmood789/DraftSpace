import type { JSONContent } from "@tiptap/core";

export const MAX_IMPORT_BYTES = 100 * 1024;

export function textFileError(file: { name: string; size: number } | null): string | null {
  if (!file || !file.name) return "Choose a .txt file to import.";
  if (!file.name.toLowerCase().endsWith(".txt")) return "Only .txt files are supported. Choose a UTF-8 text file.";
  if (file.size > MAX_IMPORT_BYTES) return "This file is too large. Choose a .txt file up to 100 KB.";
  if (!file.size) return "This file is empty. Choose a file containing some text.";
  return null;
}

export async function parseTextFile(file: File): Promise<{ title: string; content: JSONContent }> {
  const error = textFileError(file);
  if (error) throw new Error(error);
  let text: string;
  try {
    // Fatal decoding rejects invalid byte sequences instead of silently damaging text.
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error("We couldn’t read this file as UTF-8 text. Save it with UTF-8 encoding and try again.");
  }
  if (!text.trim()) throw new Error("This file is empty. Choose a file containing some text.");
  for (const character of text) {
    const code = character.charCodeAt(0);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      throw new Error("This file contains binary or unsupported control characters. Choose a plain text file.");
    }
  }

  const filename = file.name.split(/[/\\]/).at(-1) ?? file.name;
  const title = filename.slice(0, -4).trim().slice(0, 200).trim() || "Imported document";
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  return {
    title,
    content: {
      type: "doc",
      // Treat the source as literal text, never as HTML or Markdown.
      content: lines.map((line) => line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" }),
    },
  };
}
