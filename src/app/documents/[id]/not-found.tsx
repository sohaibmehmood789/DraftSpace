import Link from "next/link";

export default function DocumentNotFound() {
  return <main className="mx-auto max-w-xl px-6 py-24 text-center">
    <h1 className="text-2xl font-semibold text-slate-950">Document unavailable</h1>
    <p className="mt-3 leading-7 text-slate-500">This document doesn’t exist, or it hasn’t been shared with your account.</p>
    <Link href="/documents" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Back to documents</Link>
  </main>;
}
