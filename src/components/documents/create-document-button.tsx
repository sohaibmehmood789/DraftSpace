"use client";

import { useActionState } from "react";
import { createDocument } from "@/app/documents/actions";

export function CreateDocumentButton() {
  const [state, action, pending] = useActionState(createDocument, { error: null });
  return (
    <form action={action}>
      <button type="submit" disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60">
        {pending ? "Creating…" : "+ New document"}
      </button>
      {state.error && <p role="alert" className="mt-2 max-w-sm text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
