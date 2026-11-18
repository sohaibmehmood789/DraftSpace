"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

export async function signIn(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" || typeof password !== "string" ||
    email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    !password || password.length > 1024
  ) {
    return { error: "Enter a valid email address and password." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.code === "email_not_confirmed") {
        return { error: "This account’s email needs confirmation. Use a confirmed demo account." };
      }
      if (error.status === 429) {
        return { error: "Too many sign-in attempts. Please wait a moment and try again." };
      }
      return { error: "Unable to sign in. Check your email and password and try again." };
    }
  } catch {
    return { error: "We couldn’t reach the sign-in service. Please try again." };
  }

  redirect("/documents");
}

export async function signOut(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Unable to sign out. Please try again." };
  } catch {
    return { error: "We couldn’t reach the sign-in service. Please try again." };
  }
  redirect("/login");
}
