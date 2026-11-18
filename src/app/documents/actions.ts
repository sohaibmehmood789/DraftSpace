"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { parseTextFile } from "@/lib/documents/import-text";
import { validateContent } from "@/lib/documents/schema";

export async function createDocument(): Promise<{ error: string | null }> {
  let documentId: string;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please sign in again." };
    const { data, error } = await supabase.from("documents")
      .insert({ owner_id: user.id, title: "Untitled document" }).select("id").single();
    if (error || !data) return { error: "We couldn’t create your document. Please try again." };
    documentId = data.id;
  } catch {
    return { error: "We couldn’t reach the document service. Please try again." };
  }
  revalidatePath("/documents");
  redirect(`/documents/${documentId}`);
}

export async function importDocument(_previousState: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  let documentId: string;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please sign in again." };

    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "Choose a .txt file to import." };
    let imported;
    try {
      imported = await parseTextFile(file);
      imported.content = validateContent(imported.content);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "We couldn’t read this file. Please choose another file." };
    }
    const { data, error } = await supabase.from("documents")
      .insert({ owner_id: user.id, title: imported.title, content: imported.content as Json })
      .select("id").single();
    if (error || !data) return { error: "We couldn’t import your document. Please try again." };
    documentId = data.id;
  } catch {
    return { error: "We couldn’t reach the document service. Please try again." };
  }
  revalidatePath("/documents");
  redirect(`/documents/${documentId}`);
}
