"use client";

import { useActionState } from "react";
import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  const [state, action, pending] = useActionState(signOut, { error: null });
  return (
    <form action={action} className="text-right">
      <button type="submit" disabled={pending}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {state.error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
