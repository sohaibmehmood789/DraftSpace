import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportDocumentForm } from "@/components/documents/import-document-form";
import { CreateDocumentButton } from "@/components/documents/create-document-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Your documents · Document Editor" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: documents, error }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("documents").select("id, title, owner_id, updated_at").order("updated_at", { ascending: false }),
  ]);
  const shared = (await searchParams).view === "shared";
  const ownedDocuments = (documents ?? []).filter((document) => document.owner_id === user.id);
  const sharedDocuments = (documents ?? []).filter((document) => document.owner_id !== user.id);
  const visibleDocuments = shared ? sharedDocuments : ownedDocuments;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/documents" className="flex items-center gap-3 font-semibold text-slate-900"><span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white">D</span>Document Editor</Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-sm font-medium text-indigo-600">Your workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Welcome, {profile?.display_name ?? user.email?.split("@")[0] ?? "writer"}.</h1>
        <p className="mt-3 text-sm text-slate-500">Signed in as <span className="font-medium text-slate-700">{user.email}</span></p>
        <div className="mt-8 flex flex-wrap items-start gap-3"><CreateDocumentButton /><ImportDocumentForm /></div>
        <nav aria-label="Document views" className="mt-10 flex gap-6 border-b border-slate-200">
          {[{ label: "Owned", view: "owned", count: ownedDocuments.length }, { label: "Shared with me", view: "shared", count: sharedDocuments.length }].map((tab) => {
            const active = shared === (tab.view === "shared");
            return <Link key={tab.view} href={tab.view === "shared" ? "/documents?view=shared" : "/documents"} aria-current={active ? "page" : undefined}
              className={`border-b-2 pb-4 text-sm font-medium ${active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
              {tab.label}<span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tab.count}</span>
            </Link>;
          })}
        </nav>
        {error ? <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">We couldn’t load your documents. Please refresh to try again.</div> :
          visibleDocuments.length ? <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {visibleDocuments.map((document) => <li key={document.id} className="flex items-center justify-between gap-4 p-5"><Link href={`/documents/${document.id}`} className="min-w-0 flex-1 rounded py-1 font-medium text-slate-900 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600"><span className="block truncate">{document.title}</span><span className="mt-1 block text-xs font-normal text-slate-500">Updated {new Date(document.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}</span></Link><span className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{shared ? "Shared" : "Owner"}</span></li>)}
          </ul> : <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-600">D</div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{shared ? "No shared documents yet" : "No owned documents yet"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{shared ? "Documents shared with this account will appear here." : "Choose New document to start writing. Your work saves automatically."}</p>
          </section>}
      </main>
    </div>
  );
}
