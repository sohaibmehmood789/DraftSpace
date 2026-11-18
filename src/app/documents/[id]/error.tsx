"use client";

export default function DocumentError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-24 text-center">
    <h1 className="text-2xl font-semibold text-slate-950">We couldn’t open this document</h1>
    <p className="mt-3 text-slate-500">Please try again. Your saved document has not been changed.</p>
    <button onClick={reset} className="mt-6 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Try again</button>
  </main>;
}
