"use client";

import { useActionState, useState } from "react";
import { importDocument } from "@/app/documents/actions";
import { textFileError } from "@/lib/documents/import-text";

export function ImportDocumentForm() {
  const [expanded, setExpanded] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(importDocument, { error: null });
  const error = clientError ?? state.error;

  return <div className="min-w-0 sm:max-w-lg">
    <button type="button" aria-expanded={expanded} aria-controls="import-document-panel" disabled={pending}
      onClick={() => setExpanded(!expanded)}
      className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">
      Import file
    </button>
    {expanded && <form id="import-document-panel" action={action} aria-label="Import text file"
      className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
      <label htmlFor="import-file" className="block text-sm font-semibold text-slate-900">Choose a text file</label>
      <p id="import-file-help" className="mt-1 text-sm leading-6 text-slate-500">UTF-8 .txt files only, up to 100 KB. The filename becomes the title, and the text opens as a new editable document.</p>
      <input id="import-file" name="file" type="file" accept=".txt,text/plain" required disabled={pending}
        aria-describedby={`import-file-help${error ? " import-file-error" : ""}`} aria-invalid={Boolean(error)}
        onChange={(event) => setClientError(textFileError(event.target.files?.[0] ?? null))}
        className="mt-4 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60" />
      {error && <p id="import-file-error" role="alert" className="mt-3 text-sm leading-6 text-red-700">{error}</p>}
      <button type="submit" disabled={pending || Boolean(clientError)}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Importing…" : "Import document"}
      </button>
    </form>}
  </div>;
}
