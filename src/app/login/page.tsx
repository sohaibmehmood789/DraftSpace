import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sign in · Document Editor" };

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/documents");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
        <section className="flex flex-col justify-between bg-indigo-950 p-8 text-white sm:p-12">
          <div>
            <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-indigo-500 font-semibold">D</span><span className="text-sm font-semibold">Document Editor</span></div>
            <h1 className="mt-12 hidden max-w-sm text-4xl font-semibold leading-tight tracking-tight lg:block lg:text-5xl">Good work starts with a shared idea.</h1>
            <p className="mt-5 hidden max-w-sm leading-7 text-indigo-200 lg:block">A simple space to write, organize your documents, and work with your team.</p>
          </div>
          <p className="mt-12 hidden text-xs text-indigo-300 lg:block">A lightweight collaborative document editor.</p>
        </section>
        <section aria-labelledby="login-heading" className="p-8 sm:p-12">
          <h2 id="login-heading" className="text-2xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
          <p className="mb-8 mt-2 text-sm text-slate-500">Sign in to your document workspace.</p>
          <LoginForm configured={configured} />
        </section>
      </div>
    </main>
  );
}
