"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";

export function useDocumentSave(document: { id: string; title: string; content: JSONContent; updated_at: string }) {
  const latest = useRef({ title: document.title, content: document.content, revision: 0 });
  const savedRevision = useRef(0);
  const version = useRef(document.updated_at);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (blocked.current) return false;
    if (inFlight.current) return inFlight.current;
    if (latest.current.revision === savedRevision.current) return true;

    const task = (async () => {
      // Serialize writes. Edits made during a request are sent in the next pass;
      // an older response never marks newer edits as saved.
      while (savedRevision.current < latest.current.revision) {
        const snapshot = latest.current;
        if (!snapshot.title.trim() || snapshot.title.trim().length > 200) {
          setStatus("error");
          setError("Give your document a title between 1 and 200 characters.");
          return false;
        }
        setStatus("saving");
        setError(null);
        try {
          const response = await fetch(`/api/documents/${document.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: snapshot.title, content: snapshot.content, updatedAt: version.current }),
            signal: AbortSignal.timeout(20_000),
          });
          const result = await response.json();
          if (!response.ok) {
            if (response.status === 409) { blocked.current = true; setConflict(true); }
            setStatus("error");
            setError(result.error ?? "We couldn’t save your document. Please try again.");
            return false;
          }
          version.current = result.updatedAt;
          savedRevision.current = snapshot.revision;
        } catch {
          setStatus("error");
          setError("Save failed. Check your connection, then choose Save to retry. Your edits are still here.");
          return false;
        }
      }
      setStatus("saved");
      setError(null);
      return true;
    })();
    inFlight.current = task;
    try { return await task; } finally { inFlight.current = null; }
  }, [document.id]);

  const change = useCallback((patch: { title?: string; content?: JSONContent }) => {
    latest.current = { ...latest.current, ...patch, revision: latest.current.revision + 1 };
    if (timer.current) clearTimeout(timer.current);
    if (blocked.current) return;
    setStatus(inFlight.current ? "saving" : "unsaved");
    setError(null);
    timer.current = setTimeout(() => { void save(); }, 800);
  }, [save]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (savedRevision.current !== latest.current.revision) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", shortcut);
      if (timer.current) clearTimeout(timer.current);
      // Also flush on client-side navigation, where beforeunload does not fire.
      void save();
    };
  }, [save]);

  return { status, error, conflict, change, save };
}
