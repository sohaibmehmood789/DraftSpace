import { isDeepStrictEqual } from "node:util";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { isDocumentId, validateContent, validateTitle } from "@/lib/documents/schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDocumentId(id)) return Response.json({ error: "Document unavailable." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Your session expired. Sign in again before saving." }, { status: 401 });

  let title: string;
  let content: Json;
  let updatedAt: string;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 600_000) {
      return Response.json({ error: "This document is too large to save." }, { status: 413 });
    }
    const input = JSON.parse(body);
    title = validateTitle(input?.title);
    content = validateContent(input?.content) as Json;
    updatedAt = input?.updatedAt;
    if (typeof updatedAt !== "string" || updatedAt.length > 50 || !Number.isFinite(Date.parse(updatedAt))) {
      throw new Error("The document version is missing. Reload the document before saving.");
    }
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? "Invalid save request." : error instanceof Error ? error.message : "Invalid document." }, { status: 400 });
  }

  const { data, error } = await supabase.from("documents")
    .update({ title, content }).eq("id", id).eq("updated_at", updatedAt)
    .select("updated_at").maybeSingle();
  if (error) return Response.json({ error: "We couldn’t save your document. Please try again." }, { status: 500 });
  if (!data) {
    const { data: current, error: readError } = await supabase.from("documents")
      .select("title, content, updated_at").eq("id", id).maybeSingle();
    if (readError) return Response.json({ error: "We couldn’t check your document. Please try again." }, { status: 500 });
    if (!current) return Response.json({ error: "This document is unavailable or you no longer have access." }, { status: 404 });
    // A response may have been lost after a successful write. Retrying identical
    // content is safe, even if the caller still has the previous timestamp.
    if (current.title === title && isDeepStrictEqual(current.content, content)) {
      return Response.json({ updatedAt: current.updated_at, title });
    }
    return Response.json({ error: "This document was updated in another tab. Copy your unsaved changes, then reload to get the latest version." }, { status: 409 });
  }
  revalidatePath("/documents");
  return Response.json({ updatedAt: data.updated_at, title });
}
