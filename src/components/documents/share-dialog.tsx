"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DocumentShare = { shared_with: string; display_name: string; email: string };

export function ShareDialog({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const endpoint = `/api/documents/${documentId}/sharing`;

  const load = useCallback((signal?: AbortSignal) => {
    return fetch(endpoint, { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) })
      .then(async (response) => {
        const result = await response.json();
        if (signal?.aborted) return;
        if (!response.ok) { setReady(false); setError(result.error); return; }
        setShares(result.shares);
        setReady(true);
      })
      .catch(() => {
        if (signal?.aborted) return;
        setReady(false);
        setError("We couldn’t load sharing details. Please try again.");
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [endpoint]);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function updateAccess(method: "POST" | "DELETE", body: object, pendingKey: string, success: string) {
    setPending(pendingKey);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "We couldn’t update access. Please try again."); return; }
      setShares(result.shares);
      setMessage(success);
      if (method === "POST") setEmail("");
    } catch {
      setError("We couldn’t confirm the change. Close and reopen sharing to check access, then try again if needed.");
    } finally { setPending(null); }
  }

  return <dialog ref={dialog} aria-labelledby="share-heading" aria-describedby="share-description" onCancel={onClose}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/40 sm:p-8">
    <div className="flex items-start justify-between gap-4">
      <h2 id="share-heading" className="text-xl font-semibold">Share document</h2>
      <button type="button" aria-label="Close sharing dialog" onClick={onClose} className="rounded-md px-2 text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-indigo-600">×</button>
    </div>
    <p id="share-description" className="mt-2 text-sm leading-6 text-slate-500">Add a registered user by email. They’ll be able to open and edit this document.</p>
    <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void updateAccess("POST", { email: email.trim() }, "grant", `Access granted to ${email.trim()}.`); }}>
      <label htmlFor="share-email" className="block text-sm font-medium">Email address</label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input id="share-email" type="email" required maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!ready || Boolean(pending) || loading}
          placeholder="editor@example.com" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" />
        <button type="submit" disabled={!ready || Boolean(pending) || loading} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50">{pending === "grant" ? "Sharing…" : "Grant access"}</button>
      </div>
    </form>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{message}</p>}
    <section aria-labelledby="access-heading" className="mt-7 border-t border-slate-200 pt-5">
      <h3 id="access-heading" className="text-sm font-semibold">People with access</h3>
      <div className="mt-4 flex items-center justify-between text-sm"><span className="font-medium">You</span><span className="text-slate-500">Owner</span></div>
      {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading access…</p> : !ready ?
        <button type="button" onClick={() => { setLoading(true); setError(null); void load(); }} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">Retry loading access</button> :
        shares.length ? <ul className="mt-3 divide-y divide-slate-100">
          {shares.map((share) => <li key={share.shared_with} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{share.display_name}</p><p className="break-all text-xs text-slate-500">{share.email} · Can edit</p></div>
            <button type="button" aria-label={`Remove access for ${share.email}`} disabled={Boolean(pending)}
              onClick={() => { void updateAccess("DELETE", { sharedWith: share.shared_with }, share.shared_with, `Access removed for ${share.email}.`); }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-indigo-600 disabled:opacity-50">{pending === share.shared_with ? "Removing…" : "Remove"}</button>
          </li>)}
        </ul> : <p className="mt-4 text-sm text-slate-500">Only you have access.</p>}
    </section>
    <p className="mt-5 text-xs leading-5 text-slate-400">Only the owner can grant or remove access. Documents are private until shared.</p>
  </dialog>;
}
