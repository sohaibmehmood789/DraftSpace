"use client";

import { useActionState, useState } from "react";
import { signIn } from "@/app/login/actions";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/demo-accounts";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, { error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div>
      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-800">Email address</label>
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
            value={email} onChange={(event) => setEmail(event.target.value)}
            disabled={pending || !configured} placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60" />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-800">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024}
            value={password} onChange={(event) => setPassword(event.target.value)}
            disabled={pending || !configured}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60" />
        </div>
        {!configured && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Supabase needs to be configured before you can sign in.</p>}
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending || !configured}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-sm font-semibold text-slate-800">Try the demo accounts</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">Choose an account to fill the form, then sign in.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button key={account.email} type="button" disabled={pending || !configured}
              onClick={() => { setEmail(account.email); setPassword(DEMO_PASSWORD); }}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">
              <span className="block text-sm font-semibold text-slate-800">Use {account.name.toLowerCase()}</span>
              <span className="mt-1 block text-xs text-slate-500">{account.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Demo password: <code>{DEMO_PASSWORD}</code>. These accounts are shared for assessment use.</p>
      </div>
    </div>
  );
}
